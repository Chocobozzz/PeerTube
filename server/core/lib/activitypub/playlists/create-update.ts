import { guessAspectRatio, promiseMap } from '@peertube/peertube-core-utils'
import { ActivityIconObject, HttpStatusCode, PlaylistElementObject, PlaylistObject } from '@peertube/peertube-models'
import { isActivityPubUrlValid } from '@server/helpers/custom-validators/activitypub/misc.js'
import { retryTransactionWrapper, runTransaction } from '@server/helpers/database-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { PeerTubeRequestError } from '@server/helpers/requests.js'
import { ACTIVITY_PUB, CRAWL_REQUEST_CONCURRENCY } from '@server/initializers/constants.js'
import { updateRemotePlaylistThumbnailFromUrl } from '@server/lib/thumbnail.js'
import { VideoPlaylistElementModel } from '@server/models/video/video-playlist-element.js'
import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import { MAccountHost, MVideoId, MVideoPlaylist, MVideoPlaylistFull } from '@server/types/models/index.js'
import { Transaction } from 'sequelize'
import { getAPId } from '../activity.js'
import { getOrCreateAPActor } from '../actors/index.js'
import { runWithAPObjectLock } from '../ap-object-lock.js'
import { crawlCollectionPage } from '../crawl.js'
import { checkUrlsSameHost, isLocalUrl } from '../url.js'
import { getOrCreateAPVideo } from '../videos/index.js'
import {
  fetchRemotePlaylistElement,
  fetchRemoteVideoPlaylist,
  playlistElementObjectToDBAttributes,
  playlistObjectToDBAttributes
} from './shared/index.js'

const logger = createLogger('ap', 'playlist')

export async function createAccountPlaylists (playlistUrls: string[], account: MAccountHost) {
  logger.info(
    `Creating or updating ${playlistUrls.length} playlists for account ${account.Actor.preferredUsername}`
  )

  await promiseMap(playlistUrls, async playlistUrl => {
    await logger.withContext([ playlistUrl ], async () => {
      if (!checkUrlsSameHost(playlistUrl, account.Actor.url)) {
        logger.warn(`Playlist ${playlistUrl} is not on the same host as owner account ${account.Actor.url}`)
        return
      }

      try {
        const exists = await VideoPlaylistModel.doesPlaylistExist(playlistUrl)
        if (exists === true) return

        const { playlistObject } = await fetchRemoteVideoPlaylist(playlistUrl)

        if (playlistObject === undefined) {
          throw new Error(`Cannot refresh remote playlist ${playlistUrl}: invalid body.`)
        }

        return createOrUpdateVideoPlaylist({ playlistObject, contextUrl: playlistUrl })
      } catch (err) {
        logger.warn(`Cannot create or update playlist ${playlistUrl}`, { err })
      }
    })
  }, { concurrency: CRAWL_REQUEST_CONCURRENCY })
}

export async function createOrUpdateVideoPlaylist (options: {
  playlistObject: PlaylistObject
  // Which is the context where we retrieved the playlist
  // Can be the actor that signed the activity URL or the playlist URL we fetched
  contextUrl: string
  to?: string[]
}) {
  const { playlistObject, contextUrl, to } = options

  // Federation must never create or update a playlist we own
  if (isLocalUrl(playlistObject.id)) {
    throw new Error(`Cannot create or update local playlist ${playlistObject.id} from a remote actor`)
  }

  if (!checkUrlsSameHost(playlistObject.id, contextUrl)) {
    throw new Error(`Playlist ${playlistObject.id} is not on the same host as context URL ${contextUrl}`)
  }

  // Don't fetch the elements of a stale object
  const existingPlaylist = await VideoPlaylistModel.loadByUrl(playlistObject.id)
  if (isStaleObject(existingPlaylist, playlistObject)) return VideoPlaylistModel.loadWithAccountAndChannel(existingPlaylist.id, null)

  // Outside the lock: fetching the elements and creating their videos can take a long time
  const channel = await getRemotePlaylistChannel(playlistObject)
  const elements = await fetchElements(playlistObject)

  return runWithAPObjectLock(playlistObject.id, async () => {
    // Load again now we have the lock: the playlist may have been created, or a newer object processed, while we were fetching the elements
    const existingPlaylist = await VideoPlaylistModel.loadByUrl(playlistObject.id)
    if (isStaleObject(existingPlaylist, playlistObject)) return VideoPlaylistModel.loadWithAccountAndChannel(existingPlaylist.id, null)

    logger.debug(`${existingPlaylist ? 'Updating' : 'Creating'} playlist ${playlistObject.id}`)

    const playlistAttributes = playlistObjectToDBAttributes(playlistObject, to || playlistObject.to)

    // Remote playlists provide their UUID: don't let them reuse the UUID of another (local or remote) playlist
    if (await VideoPlaylistModel.isUUIDUsedByAnotherPlaylist({ uuid: playlistAttributes.uuid, url: playlistAttributes.url })) {
      throw new Error(`Playlist ${playlistObject.id} uses UUID ${playlistAttributes.uuid} that already exists for another playlist`)
    }

    playlistAttributes.videoChannelId = channel.id
    playlistAttributes.ownerAccountId = channel.accountId

    const { playlistId, elementsLength } = await savePlaylistAndElements({ existingPlaylist, playlistAttributes, elements })

    // Load the associations
    const playlist = await VideoPlaylistModel.loadWithAccountAndChannel(playlistId, null)
    playlist.setVideosLength(elementsLength)

    await updatePlaylistThumbnail(playlistObject, playlist)

    return playlist
  })
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function isStaleObject (existingPlaylist: MVideoPlaylist, playlistObject: PlaylistObject) {
  if (!existingPlaylist?.remoteUpdatedAt || new Date(playlistObject.updated) >= existingPlaylist.remoteUpdatedAt) return false

  logger.info(
    'Skip update of remote playlist %s with an object older than the stored one.',
    playlistObject.id,
    { updated: playlistObject.updated, remoteUpdatedAt: existingPlaylist.remoteUpdatedAt }
  )

  return true
}

async function savePlaylistAndElements (options: {
  existingPlaylist: MVideoPlaylist
  playlistAttributes: ReturnType<typeof playlistObjectToDBAttributes>
  elements: FetchedElement[]
}) {
  const { existingPlaylist, playlistAttributes, elements } = options

  const result = await retryTransactionWrapper(() =>
    runTransaction(async transaction => {
      let playlistId: number

      if (existingPlaylist) {
        playlistId = existingPlaylist.id

        // Static create/update rather than instance save in case of transaction rollback
        // Keep the creation date we stored the first time
        const { createdAt: _createdAt, ...updateAttributes } = playlistAttributes
        await VideoPlaylistModel.update(updateAttributes, { where: { id: playlistId }, transaction, silent: true })
      } else {
        const created = await VideoPlaylistModel.create(playlistAttributes, { transaction, silent: true })
        playlistId = created.id
      }

      const elementsLength = await rebuildVideoPlaylistElements({ elements, playlistId, transaction })

      return { playlistId, elementsLength }
    })
  )

  logger.info('%s playlist %s with %d elements.', existingPlaylist ? 'Updated' : 'Created', playlistAttributes.url, result.elementsLength)

  return result
}

async function getRemotePlaylistChannel (playlistObject: PlaylistObject) {
  let channelUrl: string

  if (isActivityPubUrlValid(playlistObject.audience)) { // fep-1b12
    channelUrl = getAPId(playlistObject.audience)
  } else if (playlistObject.attributedTo.length !== 0) {
    channelUrl = getAPId(playlistObject.attributedTo[0])
  } else {
    throw new Error('Missing "audience" or "attributedTo" attribute for playlist object ' + getAPId(playlistObject))
  }

  if (!checkUrlsSameHost(channelUrl, playlistObject.id)) {
    throw new Error(`Playlist ${getAPId(playlistObject)} and "audience" or "attributedTo" channel ${channelUrl} are not on the same host`)
  }

  const actor = await getOrCreateAPActor(channelUrl, 'all')

  if (!actor.VideoChannel) {
    throw new Error(`Playlist ${getAPId(playlistObject)} "audience" or "attributedTo" is not a video channel`)
  }

  return actor.VideoChannel
}

async function fetchElementUrls (playlistObject: PlaylistObject) {
  let accItems: string[] = []

  // Stop crawling remote pages entirely once we hit the element limit
  const abortController = new AbortController()

  try {
    await crawlCollectionPage<string>(
      playlistObject.id,
      items => {
        accItems = accItems.concat(items.slice(0, ACTIVITY_PUB.MAX_PLAYLIST_ELEMENTS - accItems.length))

        if (accItems.length >= ACTIVITY_PUB.MAX_PLAYLIST_ELEMENTS) {
          logger.warn(
            'Playlist %s has more than %d elements, truncating and stopping the crawl.',
            getAPId(playlistObject),
            ACTIVITY_PUB.MAX_PLAYLIST_ELEMENTS
          )

          abortController.abort()
        }

        return Promise.resolve()
      },
      undefined,
      abortController.signal
    )
  } catch (err) {
    // We voluntarily aborted the crawl above once the element limit was reached, this is not an error
    if (abortController.signal.aborted !== true) throw err
  }

  return accItems.filter(i => isActivityPubUrlValid(i))
}

async function updatePlaylistThumbnail (playlistObject: PlaylistObject, playlist: MVideoPlaylistFull) {
  // This field has been sanitized in the validator
  const icons = playlistObject.icon as ActivityIconObject[]

  // Playlist does not have an icon, destroy existing one
  if (icons.length === 0) {
    await playlist.removeThumbnails(undefined)

    return
  }

  const thumbnails = icons.map(icon => {
    return updateRemotePlaylistThumbnailFromUrl({
      fileUrl: icon.url,
      playlist,
      size: { ...icon, aspectRatio: guessAspectRatio(icon.width, icon.height) }
    })
  })

  try {
    await runTransaction(async t => {
      await playlist.replaceAndSaveThumbnails(thumbnails, t)
    })
  } catch (err) {
    logger.debug(
      `Failed to update thumbnail for playlist ${playlist.url} with icon ${icons[0].url}, maybe because of concurrent request`,
      { err }
    )
  }
}

type FetchedElement = { elementObject: PlaylistElementObject, video: MVideoId }

async function fetchElements (playlistObject: PlaylistObject) {
  const elementUrls = await fetchElementUrls(playlistObject)
  const elements: FetchedElement[] = []

  await promiseMap(elementUrls, async elementUrl => {
    try {
      const { elementObject } = await fetchRemotePlaylistElement(elementUrl)

      const { video } = await getOrCreateAPVideo({ videoObject: { id: elementObject.url }, fetchType: 'with-blacklist' })

      elements.push({ elementObject, video })
    } catch (err) {
      const logLevel = (err as PeerTubeRequestError).statusCode === HttpStatusCode.UNAUTHORIZED_401
        ? 'debug'
        : 'warn'

      logger.log(logLevel, `Cannot add playlist element ${elementUrl}`, { err })
    }
  }, { concurrency: CRAWL_REQUEST_CONCURRENCY })

  return elements
}

async function rebuildVideoPlaylistElements (options: {
  elements: FetchedElement[]
  playlistId: number
  transaction: Transaction
}) {
  const { elements, playlistId, transaction } = options

  const elementsToCreate = elements.map(({ elementObject, video }) =>
    playlistElementObjectToDBAttributes(elementObject, { id: playlistId }, video)
  )

  await VideoPlaylistElementModel.deleteAllOf(playlistId, transaction)

  for (const element of elementsToCreate) {
    await VideoPlaylistElementModel.create(element, { transaction })
  }

  return elementsToCreate.length
}
