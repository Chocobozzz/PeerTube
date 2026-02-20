import {
  NSFWFlag,
  VideoChannelActivityAction,
  VideoEmbedPrivacyPolicy,
  VideoImportCreate,
  VideoImportPayload,
  VideoImportState,
  VideoPrivacy,
  VideoState
} from '@peertube/peertube-models'
import { isVTTFileValid } from '@server/helpers/custom-validators/video-captions.js'
import { isVideoFileExtnameValid } from '@server/helpers/custom-validators/videos.js'
import { isResolvingToUnicastOnly } from '@server/helpers/dns.js'
import { guessLanguageFromReq, t } from '@server/helpers/i18n.js'
import { logger } from '@server/helpers/logger.js'
import { YoutubeDlImportError, YoutubeDlImportErrorCode, YoutubeDLInfo, YoutubeDLWrapper } from '@server/helpers/youtube-dl/index.js'
import { CONFIG } from '@server/initializers/config.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { ServerConfigManager } from '@server/lib/server-config-manager.js'
import { autoBlacklistVideoIfNeeded } from '@server/lib/video-blacklist.js'
import { setVideoTags } from '@server/lib/video.js'
import { VideoChannelActivityModel } from '@server/models/video/video-channel-activity.js'
import { VideoImportModel } from '@server/models/video/video-import.js'
import { VideoPasswordModel } from '@server/models/video/video-password.js'
import { VideoModel } from '@server/models/video/video.js'
import { FilteredModelAttributes } from '@server/types/index.js'
import {
  MChannelAccountDefault,
  MChannelSync,
  MThumbnail,
  MUserAccountId,
  MVideo,
  MVideoAccountDefault,
  MVideoImportFormattable,
  MVideoTag,
  MVideoThumbnail,
  MVideoWithBlacklistLight
} from '@server/types/models/index.js'
import express from 'express'
import { remove } from 'fs-extra/esm'
import { getLocalVideoActivityPubUrl } from './activitypub/url.js'
import { createLocalVideoThumbnailsFromUrl, createLocalVideoThumbnailsFromImage } from './thumbnail.js'
import { createLocalCaption } from './video-captions.js'
import { replaceChapters, replaceChaptersFromDescriptionIfNeeded } from './video-chapters.js'

// ---------------------------------------------------------------------------

export async function insertFromImportIntoDB (parameters: {
  video: MVideoThumbnail
  thumbnails: MThumbnail[]
  videoChannel: MChannelAccountDefault
  tags: string[]
  videoImportAttributes: FilteredModelAttributes<VideoImportModel>
  user: MUserAccountId
  videoPasswords?: string[]
}): Promise<MVideoImportFormattable> {
  const { video, thumbnails, videoChannel, tags, videoImportAttributes, user, videoPasswords } = parameters

  const videoImport = await sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    const videoCreated = await video.save(
      sequelizeOptions
    ) as (MVideoAccountDefault & MVideoWithBlacklistLight & MVideoTag & MVideoThumbnail)
    videoCreated.VideoChannel = videoChannel

    if (thumbnails.length !== 0) {
      await videoCreated.replaceAndSaveThumbnails(thumbnails, t)
    }

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

    await VideoChannelActivityModel.addVideoImportActivity({
      action: VideoChannelActivityAction.CREATE,
      channel: videoChannel,
      videoImport,
      video: videoCreated,
      user,
      transaction: t
    })

    return videoImport
  })

  return videoImport
}

export async function buildVideoFromImport ({ channelId, importData, importDataOverride, importType }: {
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
    commentsPolicy: importDataOverride?.commentsPolicy ?? CONFIG.DEFAULTS.PUBLISH.COMMENTS_POLICY,
    downloadEnabled: importDataOverride?.downloadEnabled ?? CONFIG.DEFAULTS.PUBLISH.DOWNLOAD_ENABLED,
    waitTranscoding: importDataOverride?.waitTranscoding ?? true,
    embedPrivacyPolicy: VideoEmbedPrivacyPolicy.ALL_ALLOWED,
    state: VideoState.TO_IMPORT,
    nsfw: importDataOverride?.nsfw || importData.nsfw || false,
    nsfwFlags: importDataOverride?.nsfwFlags || NSFWFlag.NONE,
    nsfwSummary: importDataOverride?.nsfwSummary || null,
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

export async function buildYoutubeDLImport (options: {
  targetUrl: string
  channel: MChannelAccountDefault
  user: MUserAccountId

  channelSync?: MChannelSync
  importDataOverride?: Partial<VideoImportCreate>
  thumbnailFilePath?: string

  skipPublishedBeforeOrEq?: Date

  req?: express.Request
  res?: express.Response
}) {
  const {
    targetUrl,
    channel,
    channelSync,
    importDataOverride,
    thumbnailFilePath,
    user,
    skipPublishedBeforeOrEq,
    req,
    res
  } = options

  const userLanguage = req && res
    ? guessLanguageFromReq(req, res)
    : user.getLanguage()

  const youtubeDL = new YoutubeDLWrapper(
    targetUrl,
    ServerConfigManager.Instance.getEnabledResolutions('vod'),
    CONFIG.TRANSCODING.ALWAYS_TRANSCODE_ORIGINAL_RESOLUTION
  )

  // Get video infos
  const youtubeDLInfo = await youtubeDL.getInfoForDownload({ userLanguage })

  if (skipPublishedBeforeOrEq) {
    const onlyAfterWithoutTime = new Date(skipPublishedBeforeOrEq)
    onlyAfterWithoutTime.setHours(0, 0, 0, 0)

    if (youtubeDLInfo.originallyPublishedAtWithoutTime.getTime() < onlyAfterWithoutTime.getTime()) {
      throw new YoutubeDlImportError({
        message: t(`Video originally published at {publishedAt} is before the limit of {limit}`, userLanguage, {
          publishedAt: youtubeDLInfo.originallyPublishedAtWithoutTime.toLocaleString(userLanguage),
          limit: onlyAfterWithoutTime.toLocaleString(userLanguage)
        }),
        code: YoutubeDlImportErrorCode.SKIP_PUBLICATION_DATE
      })
    }
  }

  if (!await hasUnicastURLsOnly(youtubeDLInfo)) {
    throw new YoutubeDlImportError({
      message: t('Cannot use non unicast IP as targetUrl.', userLanguage),
      code: YoutubeDlImportErrorCode.NOT_ONLY_UNICAST_URL
    })
  }

  const video = await buildVideoFromImport({
    channelId: channel.id,
    importData: youtubeDLInfo,
    importDataOverride,
    importType: 'url'
  })

  const thumbnails = await processThumbnails({
    inputPath: thumbnailFilePath,
    downloadUrl: youtubeDLInfo.thumbnailUrl,
    video
  })

  const videoImport = await insertFromImportIntoDB({
    video,
    thumbnails,
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
    generateTranscription: importDataOverride.generateTranscription ?? true,
    // If part of a sync process, there is a parent job that will aggregate children results
    preventException: !!channelSync
  }

  videoImport.payload = payload
  await videoImport.save()

  return {
    videoImport,
    job: { type: 'video-import' as 'video-import', payload }
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function processThumbnails (options: {
  inputPath?: string
  downloadUrl?: string
  video: MVideoThumbnail
}): Promise<MThumbnail[]> {
  const { inputPath, downloadUrl, video } = options

  if (inputPath) {
    return createLocalVideoThumbnailsFromImage({
      inputPath,
      video,
      automaticallyGenerated: false
    })
  }

  if (downloadUrl) {
    try {
      return await createLocalVideoThumbnailsFromUrl({ downloadUrl, video })
    } catch (err) {
      logger.warn('Cannot process thumbnail %s from youtube-dl.', downloadUrl, { err })
    }
  }

  return []
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

      await createLocalCaption({
        language: subtitle.language,
        path: subtitle.path,
        video,
        automaticallyGenerated: false
      })

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
