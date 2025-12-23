import { HttpStatusCode, PlaylistObject } from '@peertube/peertube-models'
import { isArray } from '@server/helpers/custom-validators/misc.js'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { PeerTubeRequestError } from '@server/helpers/requests.js'
import { CRAWL_REQUEST_CONCURRENCY } from '@server/initializers/constants.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { updateRemotePlaylistMiniatureFromUrl } from '@server/lib/thumbnail.js'
import { VideoPlaylistElementModel } from '@server/models/video/video-playlist-element.js'
import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import { FilteredModelAttributes } from '@server/types/index.js'
import { MAccountHost, MThumbnail, MVideoPlaylist, MVideoPlaylistFull, MVideoPlaylistVideosLength } from '@server/types/models/index.js'
import Bluebird from 'bluebird'
import { getAPId } from '../activity.js'
import { getOrCreateAPActor } from '../actors/index.js'
import { crawlCollectionPage } from '../crawl.js'
import { checkUrlsSameHost } from '../url.js'
import { getOrCreateAPVideo } from '../videos/index.js'
import {
  fetchRemotePlaylistElement,
  fetchRemoteVideoPlaylist,
  playlistElementObjectToDBAttributes,
  playlistObjectToDBAttributes
} from './shared/index.js'
import { isActivityPubUrlValid } from '@server/helpers/custom-validators/activitypub/misc.js'

const lTags = loggerTagsFactory('ap', 'video-playlist')

export async function createAccountPlaylists (playlistUrls: string[], account: MAccountHost) {
  logger.info(
    `Creating or updating ${playlistUrls.length} playlists for account ${account.Actor.preferredUsername}`,
    lTags()
  )

  await Bluebird.map(playlistUrls, async playlistUrl => {
    if (!checkUrlsSameHost(playlistUrl, account.Actor.url)) {
      logger.warn(`Playlist ${playlistUrl} is not on the same host as owner account ${account.Actor.url}`, lTags(playlistUrl))
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
      logger.warn(`Cannot create or update playlist ${playlistUrl}`, { err, ...lTags(playlistUrl) })
    }
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

  if (!checkUrlsSameHost(playlistObject.id, contextUrl)) {
    throw new Error(`Playlist ${playlistObject.id} is not on the same host as context URL ${contextUrl}`)
  }

  logger.debug(`Creating or updating playlist ${playlistObject.id}`, lTags(playlistObject.id))

  const playlistAttributes = playlistObjectToDBAttributes(playlistObject, to || playlistObject.to)

  const channel = await getRemotePlaylistChannel(playlistObject)
  playlistAttributes.videoChannelId = channel.id
  playlistAttributes.ownerAccountId = channel.accountId

  const [ upsertPlaylist ] = await VideoPlaylistModel.upsert<MVideoPlaylistVideosLength>(playlistAttributes, { returning: true })

  const playlistElementUrls = await fetchElementUrls(playlistObject)

  // Refetch playlist from DB since elements fetching could be long in time
  const playlist = await VideoPlaylistModel.loadWithAccountAndChannel(upsertPlaylist.id, null)

  await updatePlaylistThumbnail(playlistObject, playlist)

  const elementsLength = await rebuildVideoPlaylistElements(playlistElementUrls, playlist)
  playlist.setVideosLength(elementsLength)

  return playlist
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function getRemotePlaylistChannel (playlistObject: PlaylistObject) {
  if (!isArray(playlistObject.attributedTo) || playlistObject.attributedTo.length !== 1) {
    throw new Error('Not attributed to for playlist object ' + getAPId(playlistObject))
  }

  const channelUrl = getAPId(playlistObject.attributedTo[0])
  if (!checkUrlsSameHost(channelUrl, playlistObject.id)) {
    throw new Error(`Playlist ${playlistObject.id} and "attributedTo" channel ${channelUrl} are not on the same host`)
  }

  const actor = await getOrCreateAPActor(channelUrl, 'all')

  if (!actor.VideoChannel) {
    throw new Error(`Playlist ${playlistObject.id} "attributedTo" is not a video channel.`)
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
  if (playlistObject.icon) {
    let thumbnailModel: MThumbnail

    try {
      thumbnailModel = await updateRemotePlaylistMiniatureFromUrl({ downloadUrl: playlistObject.icon.url, playlist })
      await playlist.setAndSaveThumbnail(thumbnailModel, undefined)
    } catch (err) {
      logger.warn('Cannot set thumbnail of %s.', playlistObject.id, { err, ...lTags(playlistObject.id, playlist.uuid, playlist.url) })

      if (thumbnailModel) await thumbnailModel.removeThumbnail()
    }

    return
  }

  // Playlist does not have an icon, destroy existing one
  if (playlist.hasThumbnail()) {
    await playlist.Thumbnail.destroy()
    playlist.Thumbnail = null
  }
}

async function rebuildVideoPlaylistElements (elementUrls: string[], playlist: MVideoPlaylist) {
  const elementsToCreate = await buildElementsDBAttributes(elementUrls, playlist)

  await retryTransactionWrapper(() =>
    sequelizeTypescript.transaction(async t => {
      await VideoPlaylistElementModel.deleteAllOf(playlist.id, t)

      for (const element of elementsToCreate) {
        await VideoPlaylistElementModel.create(element, { transaction: t })
      }
    })
  )

  logger.info('Rebuilt playlist %s with %s elements.', playlist.url, elementsToCreate.length, lTags(playlist.uuid, playlist.url))

  return elementsToCreate.length
}

async function buildElementsDBAttributes (elementUrls: string[], playlist: MVideoPlaylist) {
  const elementsToCreate: FilteredModelAttributes<VideoPlaylistElementModel>[] = []

  await Bluebird.map(elementUrls, async elementUrl => {
    try {
      const { elementObject } = await fetchRemotePlaylistElement(elementUrl)

      const { video } = await getOrCreateAPVideo({ videoObject: { id: elementObject.url }, fetchType: 'only-video-and-blacklist' })

      elementsToCreate.push(playlistElementObjectToDBAttributes(elementObject, playlist, video))
    } catch (err) {
      const logLevel = (err as PeerTubeRequestError).statusCode === HttpStatusCode.UNAUTHORIZED_401
        ? 'debug'
        : 'warn'

      logger.log(logLevel, `Cannot add playlist element ${elementUrl}`, { err, ...lTags(playlist.uuid, playlist.url) })
    }
  }, { concurrency: CRAWL_REQUEST_CONCURRENCY })

  return elementsToCreate
}
