import * as Bluebird from 'bluebird'
import { getAPId } from '@server/helpers/activitypub'
import { isArray } from '@server/helpers/custom-validators/misc'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { CRAWL_REQUEST_CONCURRENCY } from '@server/initializers/constants'
import { sequelizeTypescript } from '@server/initializers/database'
import { updatePlaylistMiniatureFromUrl } from '@server/lib/thumbnail'
import { VideoPlaylistModel } from '@server/models/video/video-playlist'
import { VideoPlaylistElementModel } from '@server/models/video/video-playlist-element'
import { FilteredModelAttributes } from '@server/types'
import { MThumbnail, MVideoPlaylist, MVideoPlaylistFull, MVideoPlaylistVideosLength } from '@server/types/models'
import { AttributesOnly } from '@shared/core-utils'
import { PlaylistObject } from '@shared/models'
import { getOrCreateAPActor } from '../actors'
import { crawlCollectionPage } from '../crawl'
import { getOrCreateAPVideo } from '../videos'
import {
  fetchRemotePlaylistElement,
  fetchRemoteVideoPlaylist,
  playlistElementObjectToDBAttributes,
  playlistObjectToDBAttributes
} from './shared'

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

  const actor = await getOrCreateAPActor(playlistObject.attributedTo[0], 'all')

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
      thumbnailModel = await updatePlaylistMiniatureFromUrl({ downloadUrl: playlistObject.icon.url, playlist })
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

  await sequelizeTypescript.transaction(async t => {
    await VideoPlaylistElementModel.deleteAllOf(playlist.id, t)

    for (const element of elementsToCreate) {
      await VideoPlaylistElementModel.create(element, { transaction: t })
    }
  })

  logger.info('Rebuilt playlist %s with %s elements.', playlist.url, elementsToCreate.length, lTags(playlist.uuid, playlist.url))

  return elementsToCreate.length
}

async function buildElementsDBAttributes (elementUrls: string[], playlist: MVideoPlaylist) {
  const elementsToCreate: FilteredModelAttributes<VideoPlaylistElementModel>[] = []

  await Bluebird.map(elementUrls, async elementUrl => {
    try {
      const { elementObject } = await fetchRemotePlaylistElement(elementUrl)

      const { video } = await getOrCreateAPVideo({ videoObject: { id: elementObject.url }, fetchType: 'only-video' })

      elementsToCreate.push(playlistElementObjectToDBAttributes(elementObject, playlist, video))
    } catch (err) {
      logger.warn('Cannot add playlist element %s.', elementUrl, { err, ...lTags(playlist.uuid, playlist.url) })
    }
  }, { concurrency: CRAWL_REQUEST_CONCURRENCY })

  return elementsToCreate
}
