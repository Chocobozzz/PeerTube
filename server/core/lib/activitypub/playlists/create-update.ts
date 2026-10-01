import { guessAspectRatio, promiseMap } from '@peertube/peertube-core-utils'
import { ActivityIconObject, HttpStatusCode, PlaylistElementObject, PlaylistObject } from '@peertube/peertube-models'
import { isActivityPubUrlValid } from '@server/helpers/custom-validators/activitypub/misc.js'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { PeerTubeRequestError } from '@server/helpers/requests.js'
import { CRAWL_REQUEST_CONCURRENCY } from '@server/initializers/constants.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { updateRemotePlaylistThumbnailFromUrl } from '@server/lib/thumbnail.js'
import { VideoPlaylistElementModel } from '@server/models/video/video-playlist-element.js'
import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import { MAccountHost, MVideoId, MVideoPlaylist, MVideoPlaylistFull, MVideoPlaylistVideosLength } from '@server/types/models/index.js'
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
  const storedPlaylist = await loadPlaylistIfStaleObject(playlistObject)
  if (storedPlaylist) return storedPlaylist

  // Outside the lock: fetching the elements and creating their videos can take a long time
  const channel = await getRemotePlaylistChannel(playlistObject)
  const elements = await fetchElements(playlistObject)

  return runWithAPObjectLock(playlistObject.id, async () => {
    // Check again now we have the lock: a newer object may have been processed while we were fetching the elements
    const storedPlaylist = await loadPlaylistIfStaleObject(playlistObject)
    if (storedPlaylist) return storedPlaylist

    logger.debug(`Creating or updating playlist ${playlistObject.id}`)

    const playlistAttributes = playlistObjectToDBAttributes(playlistObject, to || playlistObject.to)
    playlistAttributes.videoChannelId = channel.id
    playlistAttributes.ownerAccountId = channel.accountId

    const [ upsertPlaylist ] = await VideoPlaylistModel.upsert<MVideoPlaylistVideosLength>(playlistAttributes, { returning: true })

    // Load the associations
    const playlist = await VideoPlaylistModel.loadWithAccountAndChannel(upsertPlaylist.id, null)

    await updatePlaylistThumbnail(playlistObject, playlist)

    const elementsLength = await rebuildVideoPlaylistElements(elements, playlist)
    playlist.setVideosLength(elementsLength)

    return playlist
  })
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function loadPlaylistIfStaleObject (playlistObject: PlaylistObject) {
  const existingPlaylist = await VideoPlaylistModel.loadByUrlAndPopulateAccount(playlistObject.id)
  if (!existingPlaylist?.remoteUpdatedAt || new Date(playlistObject.updated) >= existingPlaylist.remoteUpdatedAt) return undefined

  logger.info(
    'Skip update of remote playlist %s with an object older than the stored one.',
    playlistObject.id,
    { updated: playlistObject.updated, remoteUpdatedAt: existingPlaylist.remoteUpdatedAt }
  )

  return VideoPlaylistModel.loadWithAccountAndChannel(existingPlaylist.id, null)
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
  await crawlCollectionPage<string>(playlistObject.id, items => {
    accItems = accItems.concat(items)

    return Promise.resolve()
  })

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
    await sequelizeTypescript.transaction(async t => {
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

async function rebuildVideoPlaylistElements (elements: FetchedElement[], playlist: MVideoPlaylist) {
  const elementsToCreate = elements.map(({ elementObject, video }) => playlistElementObjectToDBAttributes(elementObject, playlist, video))

  await retryTransactionWrapper(() =>
    sequelizeTypescript.transaction(async t => {
      await VideoPlaylistElementModel.deleteAllOf(playlist.id, t)

      for (const element of elementsToCreate) {
        await VideoPlaylistElementModel.create(element, { transaction: t })
      }
    })
  )

  logger.info('Rebuilt playlist %s with %s elements.', playlist.url, elementsToCreate.length)

  return elementsToCreate.length
}
