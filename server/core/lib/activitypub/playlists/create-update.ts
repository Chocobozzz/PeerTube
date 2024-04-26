import Bluebird from 'bluebird'
import { isArray } from '@server/helpers/custom-validators/misc.js'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { CRAWL_REQUEST_CONCURRENCY } from '@server/initializers/constants.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { updateRemotePlaylistMiniatureFromUrl } from '@server/lib/thumbnail.js'
import { VideoPlaylistElementModel } from '@server/models/video/video-playlist-element.js'
import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import { FilteredModelAttributes } from '@server/types/index.js'
import { MThumbnail, MVideoPlaylist, MVideoPlaylistFull, MVideoPlaylistVideosLength } from '@server/types/models/index.js'
import { PlaylistObject } from '@peertube/peertube-models'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { getAPId } from '../activity.js'
import { getOrCreateAPActor } from '../actors/index.js'
import { crawlCollectionPage } from '../crawl.js'
import { getOrCreateAPVideo } from '../videos/index.js'
import {
  fetchRemotePlaylistElement,
  fetchRemoteVideoPlaylist,
  playlistElementObjectToDBAttributes,
  playlistObjectToDBAttributes
} from './shared/index.js'

const lTags = loggerTagsFactory('ap', 'video-playlist')

async function createAccountPlaylists (playlistUrls: string[]) {
  await Bluebird.map(playlistUrls, async playlistUrl => {
    try {
      const exists = await VideoPlaylistModel.doesPlaylistExist(playlistUrl)
      if (exists === true) return

      const { playlistObject } = await fetchRemoteVideoPlaylist(playlistUrl)

      if (playlistObject === undefined) {
        throw new Error(`Cannot refresh remote playlist ${playlistUrl}: invalid body.`)
      }

      return createOrUpdateVideoPlaylist(playlistObject)
    } catch (err) {
      logger.warn('Cannot add playlist element %s.', playlistUrl, { err, ...lTags(playlistUrl) })
    }
  }, { concurrency: CRAWL_REQUEST_CONCURRENCY })
}

async function createOrUpdateVideoPlaylist (playlistObject: PlaylistObject, to?: string[]) {
  const playlistAttributes = playlistObjectToDBAttributes(playlistObject, to || playlistObject.to)

  await setVideoChannel(playlistObject, playlistAttributes)

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

export {
  createAccountPlaylists,
  createOrUpdateVideoPlaylist
}

// ---------------------------------------------------------------------------

async function setVideoChannel (playlistObject: PlaylistObject, playlistAttributes: AttributesOnly<VideoPlaylistModel>) {
  if (!isArray(playlistObject.attributedTo) || playlistObject.attributedTo.length !== 1) {
    throw new Error('Not attributed to for playlist object ' + getAPId(playlistObject))
  }

  const actor = await getOrCreateAPActor(getAPId(playlistObject.attributedTo[0]), 'all')

  if (!actor.VideoChannel) {
    logger.warn('Playlist "attributedTo" %s is not a video channel.', playlistObject.id, { playlistObject, ...lTags(playlistObject.id) })
    return
  }

  playlistAttributes.videoChannelId = actor.VideoChannel.id
  playlistAttributes.ownerAccountId = actor.VideoChannel.Account.id
}

async function fetchElementUrls (playlistObject: PlaylistObject) {
  let accItems: string[] = []
  await crawlCollectionPage<string>(playlistObject.id, items => {
    accItems = accItems.concat(items)

    return Promise.resolve()
  })

  return accItems
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

  await retryTransactionWrapper(() => sequelizeTypescript.transaction(async t => {
    await VideoPlaylistElementModel.deleteAllOf(playlist.id, t)

    for (const element of elementsToCreate) {
      await VideoPlaylistElementModel.create(element, { transaction: t })
    }
  }))

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
      logger.warn('Cannot add playlist element %s.', elementUrl, { err, ...lTags(playlist.uuid, playlist.url) })
    }
  }, { concurrency: CRAWL_REQUEST_CONCURRENCY })

  return elementsToCreate
}
