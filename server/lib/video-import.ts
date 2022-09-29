import { remove } from 'fs-extra'
import { moveAndProcessCaptionFile } from '@server/helpers/captions-utils'
import { isVTTFileValid } from '@server/helpers/custom-validators/video-captions'
import { isVideoFileExtnameValid } from '@server/helpers/custom-validators/videos'
import { isResolvingToUnicastOnly } from '@server/helpers/dns'
import { logger } from '@server/helpers/logger'
import { YoutubeDLInfo, YoutubeDLWrapper } from '@server/helpers/youtube-dl'
import { CONFIG } from '@server/initializers/config'
import { sequelizeTypescript } from '@server/initializers/database'
import { Hooks } from '@server/lib/plugins/hooks'
import { ServerConfigManager } from '@server/lib/server-config-manager'
import { setVideoTags } from '@server/lib/video'
import { autoBlacklistVideoIfNeeded } from '@server/lib/video-blacklist'
import { VideoModel } from '@server/models/video/video'
import { VideoCaptionModel } from '@server/models/video/video-caption'
import { VideoImportModel } from '@server/models/video/video-import'
import { FilteredModelAttributes } from '@server/types'
import {
  MChannelAccountDefault,
  MChannelSync,
  MThumbnail,
  MUser,
  MVideoAccountDefault,
  MVideoCaption,
  MVideoImportFormattable,
  MVideoTag,
  MVideoThumbnail,
  MVideoWithBlacklistLight
} from '@server/types/models'
import { ThumbnailType, VideoImportCreate, VideoImportPayload, VideoImportState, VideoPrivacy, VideoState } from '@shared/models'
import { getLocalVideoActivityPubUrl } from './activitypub/url'
import { updateVideoMiniatureFromExisting, updateVideoMiniatureFromUrl } from './thumbnail'

class YoutubeDlImportError extends Error {
  code: YoutubeDlImportError.CODE
  cause?: Error // Property to remove once ES2022 is used
  constructor ({ message, code }) {
    super(message)
    this.code = code
  }

  static fromError (err: Error, code: YoutubeDlImportError.CODE, message?: string) {
    const ytDlErr = new this({ message: message ?? err.message, code })
    ytDlErr.cause = err
    ytDlErr.stack = err.stack // Useless once ES2022 is used
    return ytDlErr
  }
}

namespace YoutubeDlImportError {
  export enum CODE {
    FETCH_ERROR,
    NOT_ONLY_UNICAST_URL
  }
}

// ---------------------------------------------------------------------------

async function insertFromImportIntoDB (parameters: {
  video: MVideoThumbnail
  thumbnailModel: MThumbnail
  previewModel: MThumbnail
  videoChannel: MChannelAccountDefault
  tags: string[]
  videoImportAttributes: FilteredModelAttributes<VideoImportModel>
  user: MUser
}): Promise<MVideoImportFormattable> {
  const { video, thumbnailModel, previewModel, videoChannel, tags, videoImportAttributes, user } = parameters

  const videoImport = await sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    // Save video object in database
    const videoCreated = await video.save(sequelizeOptions) as (MVideoAccountDefault & MVideoWithBlacklistLight & MVideoTag)
    videoCreated.VideoChannel = videoChannel

    if (thumbnailModel) await videoCreated.addAndSaveThumbnail(thumbnailModel, t)
    if (previewModel) await videoCreated.addAndSaveThumbnail(previewModel, t)

    await autoBlacklistVideoIfNeeded({
      video: videoCreated,
      user,
      notify: false,
      isRemote: false,
      isNew: true,
      transaction: t
    })

    await setVideoTags({ video: videoCreated, tags, transaction: t })

    // Create video import object in database
    const videoImport = await VideoImportModel.create(
      Object.assign({ videoId: videoCreated.id }, videoImportAttributes),
      sequelizeOptions
    ) as MVideoImportFormattable
    videoImport.Video = videoCreated

    return videoImport
  })

  return videoImport
}

async function buildVideoFromImport ({ channelId, importData, importDataOverride, importType }: {
  channelId: number
  importData: YoutubeDLInfo
  importDataOverride?: Partial<VideoImportCreate>
  importType: 'url' | 'torrent'
}): Promise<MVideoThumbnail> {
  let videoData = {
    name: importDataOverride?.name || importData.name || 'Unknown name',
    remote: false,
    category: importDataOverride?.category || importData.category,
    licence: importDataOverride?.licence ?? importData.licence ?? CONFIG.DEFAULTS.PUBLISH.LICENCE,
    language: importDataOverride?.language || importData.language,
    commentsEnabled: importDataOverride?.commentsEnabled ?? CONFIG.DEFAULTS.PUBLISH.COMMENTS_ENABLED,
    downloadEnabled: importDataOverride?.downloadEnabled ?? CONFIG.DEFAULTS.PUBLISH.DOWNLOAD_ENABLED,
    waitTranscoding: importDataOverride?.waitTranscoding ?? true,
    state: VideoState.TO_IMPORT,
    nsfw: importDataOverride?.nsfw || importData.nsfw || false,
    description: importDataOverride?.description || importData.description,
    support: importDataOverride?.support || null,
    privacy: importDataOverride?.privacy || VideoPrivacy.PRIVATE,
    duration: 0, // duration will be set by the import job
    channelId,
    originallyPublishedAt: importDataOverride?.originallyPublishedAt
      ? new Date(importDataOverride?.originallyPublishedAt)
      : importData.originallyPublishedAtWithoutTime
  }

  videoData = await Hooks.wrapObject(
    videoData,
    importType === 'url'
      ? 'filter:api.video.import-url.video-attribute.result'
      : 'filter:api.video.import-torrent.video-attribute.result'
  )

  const video = new VideoModel(videoData)
  video.url = getLocalVideoActivityPubUrl(video)

  return video
}

async function buildYoutubeDLImport (options: {
  targetUrl: string
  channel: MChannelAccountDefault
  user: MUser
  channelSync?: MChannelSync
  importDataOverride?: Partial<VideoImportCreate>
  thumbnailFilePath?: string
  previewFilePath?: string
}) {
  const { targetUrl, channel, channelSync, importDataOverride, thumbnailFilePath, previewFilePath, user } = options

  const youtubeDL = new YoutubeDLWrapper(
    targetUrl,
    ServerConfigManager.Instance.getEnabledResolutions('vod'),
    CONFIG.TRANSCODING.ALWAYS_TRANSCODE_ORIGINAL_RESOLUTION
  )

  // Get video infos
  let youtubeDLInfo: YoutubeDLInfo
  try {
    youtubeDLInfo = await youtubeDL.getInfoForDownload()
  } catch (err) {
    throw YoutubeDlImportError.fromError(
      err, YoutubeDlImportError.CODE.FETCH_ERROR, `Cannot fetch information from import for URL ${targetUrl}`
    )
  }

  if (!await hasUnicastURLsOnly(youtubeDLInfo)) {
    throw new YoutubeDlImportError({
      message: 'Cannot use non unicast IP as targetUrl.',
      code: YoutubeDlImportError.CODE.NOT_ONLY_UNICAST_URL
    })
  }

  const video = await buildVideoFromImport({
    channelId: channel.id,
    importData: youtubeDLInfo,
    importDataOverride,
    importType: 'url'
  })

  const thumbnailModel = await forgeThumbnail({
    inputPath: thumbnailFilePath,
    downloadUrl: youtubeDLInfo.thumbnailUrl,
    video,
    type: ThumbnailType.MINIATURE
  })

  const previewModel = await forgeThumbnail({
    inputPath: previewFilePath,
    downloadUrl: youtubeDLInfo.thumbnailUrl,
    video,
    type: ThumbnailType.PREVIEW
  })

  const videoImport = await insertFromImportIntoDB({
    video,
    thumbnailModel,
    previewModel,
    videoChannel: channel,
    tags: importDataOverride?.tags || youtubeDLInfo.tags,
    user,
    videoImportAttributes: {
      targetUrl,
      state: VideoImportState.PENDING,
      userId: user.id,
      videoChannelSyncId: channelSync?.id
    }
  })

  // Get video subtitles
  await processYoutubeSubtitles(youtubeDL, targetUrl, video.id)

  let fileExt = `.${youtubeDLInfo.ext}`
  if (!isVideoFileExtnameValid(fileExt)) fileExt = '.mp4'

  const payload: VideoImportPayload = {
    type: 'youtube-dl' as 'youtube-dl',
    videoImportId: videoImport.id,
    fileExt,
    // If part of a sync process, there is a parent job that will aggregate children results
    preventException: !!channelSync
  }

  return {
    videoImport,
    job: { type: 'video-import' as 'video-import', payload }
  }
}

// ---------------------------------------------------------------------------

export {
  buildYoutubeDLImport,
  YoutubeDlImportError,
  insertFromImportIntoDB,
  buildVideoFromImport
}

// ---------------------------------------------------------------------------

async function forgeThumbnail ({ inputPath, video, downloadUrl, type }: {
  inputPath?: string
  downloadUrl?: string
  video: MVideoThumbnail
  type: ThumbnailType
}): Promise<MThumbnail> {
  if (inputPath) {
    return updateVideoMiniatureFromExisting({
      inputPath,
      video,
      type,
      automaticallyGenerated: false
    })
  } else if (downloadUrl) {
    try {
      return await updateVideoMiniatureFromUrl({ downloadUrl, video, type })
    } catch (err) {
      logger.warn('Cannot process thumbnail %s from youtubedl.', downloadUrl, { err })
    }
  }
  return null
}

async function processYoutubeSubtitles (youtubeDL: YoutubeDLWrapper, targetUrl: string, videoId: number) {
  try {
    const subtitles = await youtubeDL.getSubtitles()

    logger.info('Will create %s subtitles from youtube import %s.', subtitles.length, targetUrl)

    for (const subtitle of subtitles) {
      if (!await isVTTFileValid(subtitle.path)) {
        await remove(subtitle.path)
        continue
      }

      const videoCaption = new VideoCaptionModel({
        videoId,
        language: subtitle.language,
        filename: VideoCaptionModel.generateCaptionName(subtitle.language)
      }) as MVideoCaption

      // Move physical file
      await moveAndProcessCaptionFile(subtitle, videoCaption)

      await sequelizeTypescript.transaction(async t => {
        await VideoCaptionModel.insertOrReplaceLanguage(videoCaption, t)
      })
    }
  } catch (err) {
    logger.warn('Cannot get video subtitles.', { err })
  }
}

async function hasUnicastURLsOnly (youtubeDLInfo: YoutubeDLInfo) {
  const hosts = youtubeDLInfo.urls.map(u => new URL(u).hostname)
  const uniqHosts = new Set(hosts)

  for (const h of uniqHosts) {
    if (await isResolvingToUnicastOnly(h) !== true) {
      return false
    }
  }

  return true
}
