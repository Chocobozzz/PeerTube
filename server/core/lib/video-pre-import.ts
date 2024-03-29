import {
  ThumbnailType,
  ThumbnailType_Type,
  VideoImportCreate,
  VideoImportPayload,
  VideoImportState,
  VideoPrivacy,
  VideoState
} from '@peertube/peertube-models'
import { isVTTFileValid } from '@server/helpers/custom-validators/video-captions.js'
import { isVideoFileExtnameValid } from '@server/helpers/custom-validators/videos.js'
import { isResolvingToUnicastOnly } from '@server/helpers/dns.js'
import { logger } from '@server/helpers/logger.js'
import { YoutubeDLInfo, YoutubeDLWrapper } from '@server/helpers/youtube-dl/index.js'
import { CONFIG } from '@server/initializers/config.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { ServerConfigManager } from '@server/lib/server-config-manager.js'
import { autoBlacklistVideoIfNeeded } from '@server/lib/video-blacklist.js'
import { buildCommentsPolicy, setVideoTags } from '@server/lib/video.js'
import { VideoImportModel } from '@server/models/video/video-import.js'
import { VideoPasswordModel } from '@server/models/video/video-password.js'
import { VideoModel } from '@server/models/video/video.js'
import { FilteredModelAttributes } from '@server/types/index.js'
import {
  MChannelAccountDefault,
  MChannelSync,
  MThumbnail,
  MUser,
  MVideo,
  MVideoAccountDefault, MVideoImportFormattable,
  MVideoTag,
  MVideoThumbnail,
  MVideoWithBlacklistLight
} from '@server/types/models/index.js'
import { remove } from 'fs-extra/esm'
import { getLocalVideoActivityPubUrl } from './activitypub/url.js'
import { updateLocalVideoMiniatureFromExisting, updateLocalVideoMiniatureFromUrl } from './thumbnail.js'
import { createLocalCaption } from './video-captions.js'
import { replaceChapters, replaceChaptersFromDescriptionIfNeeded } from './video-chapters.js'

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
  videoPasswords?: string[]
}): Promise<MVideoImportFormattable> {
  const { video, thumbnailModel, previewModel, videoChannel, tags, videoImportAttributes, user, videoPasswords } = parameters

  const videoImport = await sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    // Save video object in database
    const videoCreated = await video.save(sequelizeOptions) as (MVideoAccountDefault & MVideoWithBlacklistLight & MVideoTag)
    videoCreated.VideoChannel = videoChannel

    if (thumbnailModel) await videoCreated.addAndSaveThumbnail(thumbnailModel, t)
    if (previewModel) await videoCreated.addAndSaveThumbnail(previewModel, t)

    if (videoCreated.privacy === VideoPrivacy.PASSWORD_PROTECTED) {
      await VideoPasswordModel.addPasswords(videoPasswords, video.id, t)
    }

    await autoBlacklistVideoIfNeeded({
      video: videoCreated,
      user,
      notify: false,
      isRemote: false,
      isNew: true,
      isNewFile: true,
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
    commentsPolicy: buildCommentsPolicy(importDataOverride),
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
    },
    videoPasswords: importDataOverride.videoPasswords
  })

  await sequelizeTypescript.transaction(async transaction => {
    // Priority to explicitly set description
    if (importDataOverride?.description) {
      const inserted = await replaceChaptersFromDescriptionIfNeeded({ newDescription: importDataOverride.description, video, transaction })
      if (inserted) return
    }

    // Then priority to youtube-dl chapters
    if (youtubeDLInfo.chapters.length !== 0) {
      logger.info(
        `Inserting chapters in video ${video.uuid} from youtube-dl`,
        { chapters: youtubeDLInfo.chapters, tags: [ 'chapters', video.uuid ] }
      )

      await replaceChapters({ video, chapters: youtubeDLInfo.chapters, transaction })
      return
    }

    if (video.description) {
      await replaceChaptersFromDescriptionIfNeeded({ newDescription: video.description, video, transaction })
    }
  })

  // Get video subtitles
  await processYoutubeSubtitles(youtubeDL, targetUrl, video)

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
  YoutubeDlImportError, buildVideoFromImport, buildYoutubeDLImport, insertFromImportIntoDB
}

// ---------------------------------------------------------------------------

async function forgeThumbnail ({ inputPath, video, downloadUrl, type }: {
  inputPath?: string
  downloadUrl?: string
  video: MVideoThumbnail
  type: ThumbnailType_Type
}): Promise<MThumbnail> {
  if (inputPath) {
    return updateLocalVideoMiniatureFromExisting({
      inputPath,
      video,
      type,
      automaticallyGenerated: false
    })
  }

  if (downloadUrl) {
    try {
      return await updateLocalVideoMiniatureFromUrl({ downloadUrl, video, type })
    } catch (err) {
      logger.warn('Cannot process thumbnail %s from youtube-dl.', downloadUrl, { err })
    }
  }

  return null
}

async function processYoutubeSubtitles (youtubeDL: YoutubeDLWrapper, targetUrl: string, video: MVideo) {
  try {
    const subtitles = await youtubeDL.getSubtitles()

    logger.info('Found %s subtitles candidates from youtube-dl import %s.', subtitles.length, targetUrl)

    for (const subtitle of subtitles) {
      if (!await isVTTFileValid(subtitle.path)) {
        logger.info('%s is not a valid youtube-dl subtitle, skipping', subtitle.path)
        await remove(subtitle.path)
        continue
      }

      await createLocalCaption({ language: subtitle.language, path: subtitle.path, video })

      logger.info('Added %s youtube-dl subtitle', subtitle.path)
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
