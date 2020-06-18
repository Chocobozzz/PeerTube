import { PlaylistObject } from '../../../shared/models/activitypub/objects/playlist-object'
import { crawlCollectionPage } from './crawl'
import { ACTIVITY_PUB, CRAWL_REQUEST_CONCURRENCY } from '../../initializers/constants'
import { isArray } from '../../helpers/custom-validators/misc'
import { getOrCreateActorAndServerAndModel } from './actor'
import { logger } from '../../helpers/logger'
import { VideoPlaylistModel } from '../../models/video/video-playlist'
import { doRequest } from '../../helpers/requests'
import { checkUrlsSameHost } from '../../helpers/activitypub'
import * as Bluebird from 'bluebird'
import { PlaylistElementObject } from '../../../shared/models/activitypub/objects/playlist-element-object'
import { getOrCreateVideoAndAccountAndChannel } from './videos'
import { isPlaylistElementObjectValid, isPlaylistObjectValid } from '../../helpers/custom-validators/activitypub/playlist'
import { VideoPlaylistElementModel } from '../../models/video/video-playlist-element'
import { VideoPlaylistPrivacy } from '../../../shared/models/videos/playlist/video-playlist-privacy.model'
import { sequelizeTypescript } from '../../initializers/database'
import { createPlaylistMiniatureFromUrl } from '../thumbnail'
import { FilteredModelAttributes } from '../../types/sequelize'
import { MAccountDefault, MAccountId, MVideoId } from '../../types/models'
import { MVideoPlaylist, MVideoPlaylistId, MVideoPlaylistOwner } from '../../types/models/video/video-playlist'

function playlistObjectToDBAttributes (playlistObject: PlaylistObject, byAccount: MAccountId, to: string[]) {
  const privacy = to.includes(ACTIVITY_PUB.PUBLIC)
    ? VideoPlaylistPrivacy.PUBLIC
    : VideoPlaylistPrivacy.UNLISTED

  return {
    name: playlistObject.name,
    description: playlistObject.content,
    privacy,
    url: playlistObject.id,
    uuid: playlistObject.uuid,
    ownerAccountId: byAccount.id,
    videoChannelId: null,
    createdAt: new Date(playlistObject.published),
    updatedAt: new Date(playlistObject.updated)
  }
}

function playlistElementObjectToDBAttributes (elementObject: PlaylistElementObject, videoPlaylist: MVideoPlaylistId, video: MVideoId) {
  return {
    position: elementObject.position,
    url: elementObject.id,
    startTimestamp: elementObject.startTimestamp || null,
    stopTimestamp: elementObject.stopTimestamp || null,
    videoPlaylistId: videoPlaylist.id,
    videoId: video.id
  }
}

async function createAccountPlaylists (playlistUrls: string[], account: MAccountDefault) {
  await Bluebird.map(playlistUrls, async playlistUrl => {
    try {
      const exists = await VideoPlaylistModel.doesPlaylistExist(playlistUrl)
      if (exists === true) return

      // Fetch url
      const { body } = await doRequest<PlaylistObject>({
        uri: playlistUrl,
        json: true,
        activityPub: true
      })

      if (!isPlaylistObjectValid(body)) {
        throw new Error(`Invalid playlist object when fetch account playlists: ${JSON.stringify(body)}`)
      }

      if (!isArray(body.to)) {
        throw new Error('Playlist does not have an audience.')
      }

      return createOrUpdateVideoPlaylist(body, account, body.to)
    } catch (err) {
      logger.warn('Cannot add playlist element %s.', playlistUrl, { err })
    }
  }, { concurrency: CRAWL_REQUEST_CONCURRENCY })
}

async function createOrUpdateVideoPlaylist (playlistObject: PlaylistObject, byAccount: MAccountId, to: string[]) {
  const playlistAttributes = playlistObjectToDBAttributes(playlistObject, byAccount, to)

  if (isArray(playlistObject.attributedTo) && playlistObject.attributedTo.length === 1) {
    const actor = await getOrCreateActorAndServerAndModel(playlistObject.attributedTo[0])

    if (actor.VideoChannel) {
      playlistAttributes.videoChannelId = actor.VideoChannel.id
    } else {
      logger.warn('Attributed to of video playlist %s is not a video channel.', playlistObject.id, { playlistObject })
    }
  }

  const [ playlist ] = await VideoPlaylistModel.upsert<MVideoPlaylist>(playlistAttributes, { returning: true })

  let accItems: string[] = []
  await crawlCollectionPage<string>(playlistObject.id, items => {
    accItems = accItems.concat(items)

    return Promise.resolve()
  })

  const refreshedPlaylist = await VideoPlaylistModel.loadWithAccountAndChannel(playlist.id, null)

  if (playlistObject.icon) {
    try {
      const thumbnailModel = await createPlaylistMiniatureFromUrl(playlistObject.icon.url, refreshedPlaylist)
      await refreshedPlaylist.setAndSaveThumbnail(thumbnailModel, undefined)
    } catch (err) {
      logger.warn('Cannot generate thumbnail of %s.', playlistObject.id, { err })
    }
  } else if (refreshedPlaylist.hasThumbnail()) {
    await refreshedPlaylist.Thumbnail.destroy()
    refreshedPlaylist.Thumbnail = null
  }

  return resetVideoPlaylistElements(accItems, refreshedPlaylist)
}

async function refreshVideoPlaylistIfNeeded (videoPlaylist: MVideoPlaylistOwner): Promise<MVideoPlaylistOwner> {
  if (!videoPlaylist.isOutdated()) return videoPlaylist

  try {
    const { statusCode, playlistObject } = await fetchRemoteVideoPlaylist(videoPlaylist.url)
    if (statusCode === 404) {
      logger.info('Cannot refresh remote video playlist %s: it does not exist anymore. Deleting it.', videoPlaylist.url)

      await videoPlaylist.destroy()
      return undefined
    }

    if (playlistObject === undefined) {
      logger.warn('Cannot refresh remote playlist %s: invalid body.', videoPlaylist.url)

      await videoPlaylist.setAsRefreshed()
      return videoPlaylist
    }

    const byAccount = videoPlaylist.OwnerAccount
    await createOrUpdateVideoPlaylist(playlistObject, byAccount, playlistObject.to)

    return videoPlaylist
  } catch (err) {
    logger.warn('Cannot refresh video playlist %s.', videoPlaylist.url, { err })

    await videoPlaylist.setAsRefreshed()
    return videoPlaylist
  }
}

// ---------------------------------------------------------------------------

export {
  createAccountPlaylists,
  playlistObjectToDBAttributes,
  playlistElementObjectToDBAttributes,
  createOrUpdateVideoPlaylist,
  refreshVideoPlaylistIfNeeded
}

// ---------------------------------------------------------------------------

async function resetVideoPlaylistElements (elementUrls: string[], playlist: MVideoPlaylist) {
  const elementsToCreate: FilteredModelAttributes<VideoPlaylistElementModel>[] = []

  await Bluebird.map(elementUrls, async elementUrl => {
    try {
      // Fetch url
      const { body } = await doRequest<PlaylistElementObject>({
        uri: elementUrl,
        json: true,
        activityPub: true
      })

      if (!isPlaylistElementObjectValid(body)) throw new Error(`Invalid body in video get playlist element ${elementUrl}`)

      if (checkUrlsSameHost(body.id, elementUrl) !== true) {
        throw new Error(`Playlist element url ${elementUrl} host is different from the AP object id ${body.id}`)
      }

      const { video } = await getOrCreateVideoAndAccountAndChannel({ videoObject: { id: body.url }, fetchType: 'only-video' })

      elementsToCreate.push(playlistElementObjectToDBAttributes(body, playlist, video))
    } catch (err) {
      logger.warn('Cannot add playlist element %s.', elementUrl, { err })
    }
  }, { concurrency: CRAWL_REQUEST_CONCURRENCY })

  await sequelizeTypescript.transaction(async t => {
    await VideoPlaylistElementModel.deleteAllOf(playlist.id, t)

    for (const element of elementsToCreate) {
      await VideoPlaylistElementModel.create(element, { transaction: t })
    }
  })

  logger.info('Reset playlist %s with %s elements.', playlist.url, elementsToCreate.length)

  return undefined
}

async function fetchRemoteVideoPlaylist (playlistUrl: string): Promise<{ statusCode: number, playlistObject: PlaylistObject }> {
  const options = {
    uri: playlistUrl,
    method: 'GET',
    json: true,
    activityPub: true
  }

  logger.info('Fetching remote playlist %s.', playlistUrl)

  const { response, body } = await doRequest<any>(options)

  if (isPlaylistObjectValid(body) === false || checkUrlsSameHost(body.id, playlistUrl) !== true) {
    logger.debug('Remote video playlist JSON is not valid.', { body })
    return { statusCode: response.statusCode, playlistObject: undefined }
  }

  return { statusCode: response.statusCode, playlistObject: body }
}
