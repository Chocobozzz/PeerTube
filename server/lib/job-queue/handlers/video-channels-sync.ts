/* eslint-disable */
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
  MUser,
  MVideoThumbnail
} from '@server/types/models'
import { ThumbnailType, VideoChannelImportPayload, VideoImportState, VideoPrivacy, VideoState } from '@shared/models'
import { Hooks } from '@server/lib/plugins/hooks'
import { JobQueue } from '../job-queue'
import { updateVideoMiniatureFromUrl } from '@server/lib/thumbnail'
import { isVideoFileExtnameValid } from '@server/helpers/custom-validators/videos'
import { hasUnicastURLsOnly, insertIntoDB, processYoutubeSubtitles } from '@server/helpers/youtube-dl/youtube-dl-import-utils'
import {VideoChannelSyncModel} from '@server/models/video/video-channel-sync'
import {VIDEO_CHANNEL_MAX_SYNC} from '@server/initializers/constants'
import {Job} from 'bull'

const processOptions = {
  maxBuffer: 1024 * 1024 * 30 // 30MB
}

type ChannelSyncInfo = {
  total: number
  alreadyImported: number
  errors: number
  successes: number
}

const waitSecs = (timeout: number) => new Promise(resolve => setTimeout(resolve, timeout * 1000))


function formatDateForYoutubeDl(date: Date) {
  return `${date.getFullYear()}${date.getMonth()+1}${date.getDate()}`
}

export async function processVideoChannelsSync () {
  logger.debug('Running processVideoChannelsSync')
  const serverConfig = await ServerConfigManager.Instance.getServerConfig()
  if (!serverConfig.import.videos.http.enabled) {
    logger.info('Discard channels synchronization as the HTTP upload is disabled')
    return
  }
  const syncs: VideoChannelSyncModel[] = await VideoChannelSyncModel.listSyncs()
  const youtubeDL = await YoutubeDLCLI.safeGet()

  for (const sync of syncs) {
    try {
      const syncCreationDate = sync.createdAt
      // Format
      logger.info(`Starting synchronizing "${sync.VideoChannel.name}" with external channel "${sync.externalChannelUrl}"`)
      const { errors, successes, alreadyImported } = await synchronizeChannel(sync.VideoChannel, sync.externalChannelUrl, {
        youtubeDL,
        secondsToWait: 5,
        lastVideosCount: VIDEO_CHANNEL_MAX_SYNC,
        after: formatDateForYoutubeDl(syncCreationDate)
      })
      if (errors > 0) {
        logger.error(`Finished synchronizing "${sync.VideoChannel.name}" with failures` +
          ` (failures: ${errors}, imported: ${successes}, ignored because already imported: ${alreadyImported}). Please check the logs.`)
      } else {
        logger.info(`Finished synchronizing "${sync.VideoChannel.name}" successfully` +
          ` (imported: ${successes}, ignored because already imported: ${alreadyImported})`)
      }
    } catch (ex) {
      logger.error(`Failed to synchronize channel ${sync.VideoChannel.name}: ${ex.stack}`)
    }
  }
}

export async function processVideoChannelImport (job: Job) {
  const payload = job.data as VideoChannelImportPayload
  logger.debug('Running processVideoChannelImport')
  const serverConfig = await ServerConfigManager.Instance.getServerConfig()
  if (!serverConfig.import.videos.http.enabled) {
    logger.error('Cannot import channel as the HTTP upload is disabled')
    return
  }
  const videoChannel = await VideoChannelModel.findOne({
    where: {
      id: payload.videoChannelId
    }
  })
  const youtubeDL = await YoutubeDLCLI.safeGet()
  try {
    logger.info(`Starting importing videos from external channel "${payload.externalChannelUrl}" to "${videoChannel.name}" `)
    const { errors, successes, alreadyImported } = await synchronizeChannel(videoChannel, payload.externalChannelUrl, {
      youtubeDL,
      secondsToWait: 30
    })
    if (errors > 0) {
      logger.error(`Finished importing videos to "${videoChannel.name}" with failures` +
        ` (failures: ${errors}, imported: ${successes}, ignored because already imported: ${alreadyImported}). Please check the logs.`)
    } else {
      logger.info(`Finished importing videos to "${videoChannel.name}" successfully` +
        ` (imported: ${successes}, ignored because already imported: ${alreadyImported})`)
    }
  } catch (ex) {
    logger.error(`Failed to import channel ${videoChannel.name}: ${ex.stack}`)
  }
}

type SynchronizeChannelOptions = {
  youtubeDL: YoutubeDLCLI
  secondsToWait: number
  lastVideosCount?: number
  after?: string
}
async function synchronizeChannel (channel: VideoChannelModel, externalChannelUrl: string, { youtubeDL, secondsToWait, lastVideosCount, after }: SynchronizeChannelOptions): Promise<ChannelSyncInfo> {
  const result: ChannelSyncInfo = {
    total: VIDEO_CHANNEL_MAX_SYNC,
    errors: 0,
    successes: 0,
    alreadyImported: 0
  }
  const user = await UserModel.loadByChannelActorId(channel.actorId)
  const additionalYoutubeDLArgs = [ '--skip-download', '--playlist-reverse' ]
  if (lastVideosCount) {
    additionalYoutubeDLArgs.push('--playlist-end', VIDEO_CHANNEL_MAX_SYNC.toString());
  }
  const channelInfo = await youtubeDL.getInfo({
    url: externalChannelUrl,
    format: YoutubeDLCLI.getYoutubeDLVideoFormat([]),
    processOptions,
    additionalYoutubeDLArgs,
  })
  const targetUrls: string[] = (await Promise.all(
    channelInfo.map(async video => {
      if (after && video['upload_date'] <= after) {
        return []
      }
      return video['webpage_url']
    })
  )).flat()

  await waitSecs(secondsToWait)

  for (const targetUrl of targetUrls) {
    try {
      // TODO retry pour l'import d'une chaîne ?
      if (!await VideoImportModel.urlAlreadyImported(user.id, targetUrl)) {
        await addYoutubeDLImport({
          user,
          channel,
          targetUrl
        })
        result.successes += 1
      } else {
        result.alreadyImported += 1
      }
    } catch (ex) {
      result.errors += 1
      logger.error(`An error occured while importing ${targetUrl}: ${ex.stack}`)
    }
    await waitSecs(secondsToWait)
  }
  return result
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
    err.message = `Cannot fetch information from import for URL ${targetUrl}: ${err.message}`
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
  JobQueue.Instance.createJob({ type: 'video-import', payload })
}
