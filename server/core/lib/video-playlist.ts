import * as Sequelize from 'sequelize'
import { VideoPlaylistPrivacy, VideoPlaylistType } from '@peertube/peertube-models'
import { VideoPlaylistModel } from '../models/video/video-playlist.js'
import { MAccount, MVideoThumbnail } from '../types/models/index.js'
import { MVideoPlaylistOwner, MVideoPlaylistThumbnail } from '../types/models/video/video-playlist.js'
import { getLocalVideoPlaylistActivityPubUrl } from './activitypub/url.js'
import { VideoMiniaturePermanentFileCache } from './files-cache/video-miniature-permanent-file-cache.js'
import { updateLocalPlaylistMiniatureFromExisting } from './thumbnail.js'
import { logger } from '@server/helpers/logger.js'

export async function createWatchLaterPlaylist (account: MAccount, t: Sequelize.Transaction) {
  const videoPlaylist: MVideoPlaylistOwner = new VideoPlaylistModel({
    name: 'Watch later',
    privacy: VideoPlaylistPrivacy.PRIVATE,
    type: VideoPlaylistType.WATCH_LATER,
    ownerAccountId: account.id
  })

  videoPlaylist.url = getLocalVideoPlaylistActivityPubUrl(videoPlaylist) // We use the UUID, so set the URL after building the object

  await videoPlaylist.save({ transaction: t })

  videoPlaylist.OwnerAccount = account

  return videoPlaylist
}

export async function generateThumbnailForPlaylist (videoPlaylist: MVideoPlaylistThumbnail, video: MVideoThumbnail) {
  logger.info('Generating default thumbnail to playlist %s.', videoPlaylist.url)

  const videoMiniature = video.getMiniature()
  if (!videoMiniature) {
    logger.info('Cannot generate thumbnail for playlist %s because video %s does not have any.', videoPlaylist.url, video.url)
    return
  }

  // Ensure the file is on disk
  const videoMiniaturePermanentFileCache = new VideoMiniaturePermanentFileCache()
  const inputPath = videoMiniature.isOwned()
    ? videoMiniature.getPath()
    : await videoMiniaturePermanentFileCache.downloadRemoteFile(videoMiniature)

  const thumbnailModel = await updateLocalPlaylistMiniatureFromExisting({
    inputPath,
    playlist: videoPlaylist,
    automaticallyGenerated: true,
    keepOriginal: true
  })

  thumbnailModel.videoPlaylistId = videoPlaylist.id

  videoPlaylist.Thumbnail = await thumbnailModel.save()
}
