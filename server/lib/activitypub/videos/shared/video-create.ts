import { logger } from '@server/helpers/logger'
import { sequelizeTypescript } from '@server/initializers/database'
import { createPlaceholderThumbnail, createVideoMiniatureFromUrl } from '@server/lib/thumbnail'
import { setVideoTags } from '@server/lib/video'
import { autoBlacklistVideoIfNeeded } from '@server/lib/video-blacklist'
import { VideoModel } from '@server/models/video/video'
import { VideoCaptionModel } from '@server/models/video/video-caption'
import { VideoFileModel } from '@server/models/video/video-file'
import { VideoLiveModel } from '@server/models/video/video-live'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist'
import {
  MChannelAccountLight,
  MStreamingPlaylistFilesVideo,
  MThumbnail,
  MVideoCaption,
  MVideoFullLight,
  MVideoThumbnail
} from '@server/types/models'
import { ThumbnailType, VideoObject } from '@shared/models'
import {
  getPreviewFromIcons,
  getTagsFromObject,
  getThumbnailFromIcons,
  streamingPlaylistActivityUrlToDBAttributes,
  videoActivityObjectToDBAttributes,
  videoFileActivityUrlToDBAttributes
} from './object-to-model-attributes'
import { getTrackerUrls, setVideoTrackers } from './trackers'

async function createVideo (videoObject: VideoObject, channel: MChannelAccountLight, waitThumbnail = false) {
  logger.debug('Adding remote video %s.', videoObject.id)

  const videoData = await videoActivityObjectToDBAttributes(channel, videoObject, videoObject.to)
  const video = VideoModel.build(videoData) as MVideoThumbnail

  const promiseThumbnail = createVideoMiniatureFromUrl({
    downloadUrl: getThumbnailFromIcons(videoObject).url,
    video,
    type: ThumbnailType.MINIATURE
  }).catch(err => {
    logger.error('Cannot create miniature from url.', { err })
    return undefined
  })

  let thumbnailModel: MThumbnail
  if (waitThumbnail === true) {
    thumbnailModel = await promiseThumbnail
  }

  const { autoBlacklisted, videoCreated } = await sequelizeTypescript.transaction(async t => {
    try {
      const sequelizeOptions = { transaction: t }

      const videoCreated = await video.save(sequelizeOptions) as MVideoFullLight
      videoCreated.VideoChannel = channel

      if (thumbnailModel) await videoCreated.addAndSaveThumbnail(thumbnailModel, t)

      const previewIcon = getPreviewFromIcons(videoObject)
      if (previewIcon) {
        const previewModel = createPlaceholderThumbnail({
          fileUrl: previewIcon.url,
          video: videoCreated,
          type: ThumbnailType.PREVIEW,
          size: previewIcon
        })

        await videoCreated.addAndSaveThumbnail(previewModel, t)
      }

      // Process files
      const videoFileAttributes = videoFileActivityUrlToDBAttributes(videoCreated, videoObject.url)

      const videoFilePromises = videoFileAttributes.map(f => VideoFileModel.create(f, { transaction: t }))
      const videoFiles = await Promise.all(videoFilePromises)

      const streamingPlaylistsAttributes = streamingPlaylistActivityUrlToDBAttributes(videoCreated, videoObject, videoFiles)
      videoCreated.VideoStreamingPlaylists = []

      for (const playlistAttributes of streamingPlaylistsAttributes) {
        const playlist = await VideoStreamingPlaylistModel.create(playlistAttributes, { transaction: t }) as MStreamingPlaylistFilesVideo
        playlist.Video = videoCreated

        const playlistFiles = videoFileActivityUrlToDBAttributes(playlist, playlistAttributes.tagAPObject)
        const videoFilePromises = playlistFiles.map(f => VideoFileModel.create(f, { transaction: t }))
        playlist.VideoFiles = await Promise.all(videoFilePromises)

        videoCreated.VideoStreamingPlaylists.push(playlist)
      }

      // Process tags
      const tags = getTagsFromObject(videoObject)
      await setVideoTags({ video: videoCreated, tags, transaction: t })

      // Process captions
      const videoCaptionsPromises = videoObject.subtitleLanguage.map(c => {
        const caption = new VideoCaptionModel({
          videoId: videoCreated.id,
          filename: VideoCaptionModel.generateCaptionName(c.identifier),
          language: c.identifier,
          fileUrl: c.url
        }) as MVideoCaption

        return VideoCaptionModel.insertOrReplaceLanguage(caption, t)
      })
      await Promise.all(videoCaptionsPromises)

      // Process trackers
      {
        const trackers = getTrackerUrls(videoObject, videoCreated)
        await setVideoTrackers({ video: videoCreated, trackers, transaction: t })
      }

      videoCreated.VideoFiles = videoFiles

      if (videoCreated.isLive) {
        const videoLive = new VideoLiveModel({
          streamKey: null,
          saveReplay: videoObject.liveSaveReplay,
          permanentLive: videoObject.permanentLive,
          videoId: videoCreated.id
        })

        videoCreated.VideoLive = await videoLive.save({ transaction: t })
      }

      // We added a video in this channel, set it as updated
      await channel.setAsUpdated(t)

      const autoBlacklisted = await autoBlacklistVideoIfNeeded({
        video: videoCreated,
        user: undefined,
        isRemote: true,
        isNew: true,
        transaction: t
      })

      logger.info('Remote video with uuid %s inserted.', videoObject.uuid)

      return { autoBlacklisted, videoCreated }
    } catch (err) {
      // FIXME: Use rollback hook when https://github.com/sequelize/sequelize/pull/13038 is released
      // Remove thumbnail
      if (thumbnailModel) await thumbnailModel.removeThumbnail()

      throw err
    }
  })

  if (waitThumbnail === false) {
    // Error is already caught above
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    promiseThumbnail.then(thumbnailModel => {
      if (!thumbnailModel) return

      thumbnailModel = videoCreated.id

      return thumbnailModel.save()
    })
  }

  return { autoBlacklisted, videoCreated }
}

export {
  createVideo
}
