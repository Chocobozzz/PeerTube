import { isResolvingToUnicastOnly } from '@server/helpers/dns'
import { logger } from '@server/helpers/logger'
import { YoutubeDLCLI, YoutubeDLInfo, YoutubeDLWrapper } from '@server/helpers/youtube-dl'
import { CONFIG } from '@server/initializers/config'
import { getLocalVideoActivityPubUrl } from '@server/lib/activitypub/url'
import { ServerConfigManager } from '@server/lib/server-config-manager'
import { UserModel } from '@server/models/user/user'
import { VideoModel } from '@server/models/video/video'
import { VideoChannelModel } from '@server/models/video/video-channel'
import { VideoImportModel } from '@server/models/video/video-import'
import {
  MChannelAccountDefault,
  MThumbnail,
  MUser,
  MVideoAccountDefault,
  MVideoCaption,
  MVideoImportFormattable,
  MVideoTag,
  MVideoThumbnail,
  MVideoWithBlacklistLight
} from '@server/types/models'
import { ThumbnailType, VideoImportState, VideoPrivacy, VideoState } from '@shared/models'
import { Hooks } from '@server/lib/plugins/hooks'
import { JobQueue } from '../job-queue'
import { updateVideoMiniatureFromUrl } from '@server/lib/thumbnail'
import { FilteredModelAttributes } from '@server/types'
import { sequelizeTypescript } from '@server/initializers/database'
import { autoBlacklistVideoIfNeeded } from '@server/lib/video-blacklist'
import { setVideoTags } from '@server/lib/video'
import { isVTTFileValid } from '@server/helpers/custom-validators/video-captions'
import { remove } from 'fs-extra'
import { VideoCaptionModel } from '@server/models/video/video-caption'
import { moveAndProcessCaptionFile } from '@server/helpers/captions-utils'
import { isVideoFileExtnameValid } from '@server/helpers/custom-validators/videos'

const processOptions = {
  maxBuffer: 1024 * 1024 * 30 // 30MB
}

export async function processVideoChannelsSync () {
  logger.debug('Running processVideoChannelsSync')
  const serverConfig = await ServerConfigManager.Instance.getServerConfig()
  if (!serverConfig.import.videos.http.enabled) {
    logger.info('Discard channels synchronization as the HTTP upload is disabled')
    return
  }
  const syncedChannels: VideoChannelModel[] = await VideoChannelModel.listSynced()
  const youtubeDL = await YoutubeDLCLI.safeGet()

  for (const channel of syncedChannels) {
    const channelInfo = await youtubeDL.getInfo({
      url: channel.externalChannelUrl,
      format: YoutubeDLCLI.getYoutubeDLVideoFormat([]),
      processOptions,
      additionalYoutubeDLArgs: [ '--skip-download', '--playlist-end', '3' ]
    })
    const user = await UserModel.loadByChannelActorId(channel.actorId)
    const targetUrls: string[] = (await Promise.all(channelInfo.map(async video => {
      const targetUrl = video['webpage_url']
      const imported = await VideoImportModel.urlAlreadyImported(user.id, targetUrl)
      return imported ? [] : [ targetUrl ]
    }))).flat()
    for (const targetUrl of targetUrls) {
      await addYoutubeDLImport({
        user,
        channel,
        targetUrl
      })
    }
  }
}

async function buildVideo (channelId: number, targetUrl: string, importData: YoutubeDLInfo): Promise<MVideoThumbnail> {
  let videoData = {
    name: importData.name ?? 'Unknown name',
    remote: false,
    category: importData.category,
    licence: importData.licence ?? CONFIG.DEFAULTS.PUBLISH.LICENCE,
    language: importData.language,
    commentsEnabled: CONFIG.DEFAULTS.PUBLISH.COMMENTS_ENABLED,
    downloadEnabled: CONFIG.DEFAULTS.PUBLISH.DOWNLOAD_ENABLED,
    waitTranscoding: false,
    state: VideoState.TO_IMPORT,
    nsfw: importData.nsfw ?? false,
    description: importData.description,
    support: null,
    privacy: VideoPrivacy.PUBLIC,
    duration: 0, // duration will be set by the import job
    channelId: channelId,
    originallyPublishedAt: importData.originallyPublishedAt
  }

  videoData = await Hooks.wrapObject(
    videoData,
    'filter:api.video.import-url.video-attribute.result'
  )

  const video = new VideoModel(videoData)
  video.url = getLocalVideoActivityPubUrl(video)

  return video
}

// FIXME taken from import.ts
async function insertIntoDB (parameters: {
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

async function addYoutubeDLImport (parameters: {
  user: MUser
  channel: VideoChannelModel
  targetUrl: string
}) {
  const { user, channel, targetUrl } = parameters
  const youtubeDL = new YoutubeDLWrapper(targetUrl, ServerConfigManager.Instance.getEnabledResolutions('vod'))
  // Get video infos
  let youtubeDLInfo: YoutubeDLInfo
  try {
    youtubeDLInfo = await youtubeDL.getInfoForDownload()
  } catch (err) {
    err.message = `Cannot fetch information from import for URL ${targetUrl}.`
    throw err
  }
  if (!await hasUnicastURLsOnly(youtubeDLInfo)) {
    throw new Error('Cannot use non unicast IP as targetUrl.')
  }
  const video = await buildVideo(channel.id, targetUrl, youtubeDLInfo)
  let thumbnailModel
  let previewModel
  if (youtubeDLInfo.thumbnailUrl) {
    // Process video thumbnail from url
    try {
      thumbnailModel = await updateVideoMiniatureFromUrl({ downloadUrl: youtubeDLInfo.thumbnailUrl, video, type: ThumbnailType.MINIATURE })
    } catch (err) {
      logger.warn('Cannot process thumbnail %s from youtubedl.', youtubeDLInfo.thumbnailUrl, { err })
    }

    // Process video preview from url
    try {
      previewModel = await updateVideoMiniatureFromUrl({ downloadUrl: youtubeDLInfo.thumbnailUrl, video, type: ThumbnailType.PREVIEW })
    } catch (err) {
      logger.warn('Cannot process preview %s from youtubedl.', youtubeDLInfo.thumbnailUrl, { err })
    }
  }

  const videoImport = await insertIntoDB({
    video,
    thumbnailModel,
    previewModel,
    videoChannel: channel,
    tags: youtubeDLInfo.tags,
    user: user.id,
    videoImportAttributes: {
      targetUrl,
      state: VideoImportState.PENDING,
      userId: user.id
    }
  })

  // Get video subtitles
  await processYoutubeSubtitles(youtubeDL, targetUrl, video.id)

  let fileExt = `.${youtubeDLInfo.ext}`
  if (!isVideoFileExtnameValid(fileExt)) fileExt = '.mp4'

  // Create job to import the video
  const payload = {
    type: 'youtube-dl' as 'youtube-dl',
    videoImportId: videoImport.id,
    fileExt
  }
  await JobQueue.Instance.createJobWithPromise({ type: 'video-import', payload })

}

// FIXME dans import.ts
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
// FIXME this is copy-pasted from server/controllers/api/videos/import.ts
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
