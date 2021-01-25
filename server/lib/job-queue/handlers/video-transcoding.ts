import * as Bull from 'bull'
import { TranscodeOptionsType } from '@server/helpers/ffmpeg-utils'
import { JOB_PRIORITY } from '@server/initializers/constants'
import { getJobTranscodingPriorityMalus, publishAndFederateIfNeeded } from '@server/lib/video'
import { getVideoFilePath } from '@server/lib/video-paths'
import { MUser, MUserId, MVideoFullLight, MVideoUUID, MVideoWithFile } from '@server/types/models'
import {
  HLSTranscodingPayload,
  MergeAudioTranscodingPayload,
  NewResolutionTranscodingPayload,
  OptimizeTranscodingPayload,
  VideoTranscodingPayload
} from '../../../../shared'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { computeResolutionsToTranscode } from '../../../helpers/ffprobe-utils'
import { logger } from '../../../helpers/logger'
import { CONFIG } from '../../../initializers/config'
import { sequelizeTypescript } from '../../../initializers/database'
import { VideoModel } from '../../../models/video/video'
import { federateVideoIfNeeded } from '../../activitypub/videos'
import { Notifier } from '../../notifier'
import {
  generateHlsPlaylistResolution,
  mergeAudioVideofile,
  optimizeOriginalVideofile,
  transcodeNewWebTorrentResolution
} from '../../video-transcoding'
import { JobQueue } from '../job-queue'
import { UserModel } from '@server/models/account/user'

type HandlerFunction = (job: Bull.Job, payload: VideoTranscodingPayload, video: MVideoFullLight, user: MUser) => Promise<any>

const handlers: { [ id: string ]: HandlerFunction } = {
  // Deprecated, introduced in 3.1
  'hls': handleHLSJob,
  'new-resolution-to-hls': handleHLSJob,

  // Deprecated, introduced in 3.1
  'new-resolution': handleNewWebTorrentResolutionJob,
  'new-resolution-to-webtorrent': handleNewWebTorrentResolutionJob,

  // Deprecated, introduced in 3.1
  'merge-audio': handleWebTorrentMergeAudioJob,
  'merge-audio-to-webtorrent': handleWebTorrentMergeAudioJob,

  // Deprecated, introduced in 3.1
  'optimize': handleWebTorrentOptimizeJob,
  'optimize-to-webtorrent': handleWebTorrentOptimizeJob
}

async function processVideoTranscoding (job: Bull.Job) {
  const payload = job.data as VideoTranscodingPayload
  logger.info('Processing video file in job %d.', job.id)

  const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(payload.videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info('Do not process job %d, video does not exist.', job.id)
    return undefined
  }

  const user = await UserModel.loadByChannelActorId(video.VideoChannel.actorId)

  const handler = handlers[payload.type]

  if (!handler) {
    throw new Error('Cannot find transcoding handler for ' + payload.type)
  }

  await handler(job, payload, video, user)

  return video
}

// ---------------------------------------------------------------------------
// Job handlers
// ---------------------------------------------------------------------------

async function handleHLSJob (job: Bull.Job, payload: HLSTranscodingPayload, video: MVideoFullLight) {
  const videoFileInput = payload.copyCodecs
    ? video.getWebTorrentFile(payload.resolution)
    : video.getMaxQualityFile()

  const videoOrStreamingPlaylist = videoFileInput.getVideoOrStreamingPlaylist()
  const videoInputPath = getVideoFilePath(videoOrStreamingPlaylist, videoFileInput)

  await generateHlsPlaylistResolution({
    video,
    videoInputPath,
    resolution: payload.resolution,
    copyCodecs: payload.copyCodecs,
    isPortraitMode: payload.isPortraitMode || false,
    job
  })

  await retryTransactionWrapper(onHlsPlaylistGeneration, video, payload.resolution)
}

async function handleNewWebTorrentResolutionJob (
  job: Bull.Job,
  payload: NewResolutionTranscodingPayload,
  video: MVideoFullLight,
  user: MUserId
) {
  await transcodeNewWebTorrentResolution(video, payload.resolution, payload.isPortraitMode || false, job)

  await retryTransactionWrapper(onNewWebTorrentFileResolution, video, user, payload)
}

async function handleWebTorrentMergeAudioJob (job: Bull.Job, payload: MergeAudioTranscodingPayload, video: MVideoFullLight, user: MUserId) {
  await mergeAudioVideofile(video, payload.resolution, job)

  await retryTransactionWrapper(onNewWebTorrentFileResolution, video, user, payload)
}

async function handleWebTorrentOptimizeJob (job: Bull.Job, payload: OptimizeTranscodingPayload, video: MVideoFullLight, user: MUserId) {
  const transcodeType = await optimizeOriginalVideofile(video, video.getMaxQualityFile(), job)

  await retryTransactionWrapper(onVideoFileOptimizer, video, payload, transcodeType, user)
}

// ---------------------------------------------------------------------------

async function onHlsPlaylistGeneration (video: MVideoFullLight, resolution: number) {
  if (video === undefined) return undefined

  const maxQualityFile = video.getMaxQualityFile()

  // We generated the max quality HLS playlist, we don't need the webtorrent files anymore if the admin disabled it
  if (CONFIG.TRANSCODING.WEBTORRENT.ENABLED === false && video.hasWebTorrentFiles() && maxQualityFile.resolution === resolution) {
    for (const file of video.VideoFiles) {
      await video.removeFile(file)
      await file.destroy()
    }

    video.VideoFiles = []
  }

  return publishAndFederateIfNeeded(video)
}

async function onVideoFileOptimizer (
  videoArg: MVideoWithFile,
  payload: OptimizeTranscodingPayload,
  transcodeType: TranscodeOptionsType,
  user: MUserId
) {
  if (videoArg === undefined) return undefined

  // Outside the transaction (IO on disk)
  const { videoFileResolution, isPortraitMode } = await videoArg.getMaxQualityResolution()

  const { videoDatabase, videoPublished } = await sequelizeTypescript.transaction(async t => {
    // Maybe the video changed in database, refresh it
    const videoDatabase = await VideoModel.loadAndPopulateAccountAndServerAndTags(videoArg.uuid, t)
    // Video does not exist anymore
    if (!videoDatabase) return undefined

    let videoPublished = false

    // Generate HLS version of the original file
    const originalFileHLSPayload = Object.assign({}, payload, {
      isPortraitMode,
      resolution: videoDatabase.getMaxQualityFile().resolution,
      // If we quick transcoded original file, force transcoding for HLS to avoid some weird playback issues
      copyCodecs: transcodeType !== 'quick-transcode'
    })
    await createHlsJobIfEnabled(user, originalFileHLSPayload)

    const hasNewResolutions = createLowerResolutionsJobs(videoDatabase, user, videoFileResolution, isPortraitMode)

    if (!hasNewResolutions) {
      // No transcoding to do, it's now published
      videoPublished = await videoDatabase.publishIfNeededAndSave(t)
    }

    await federateVideoIfNeeded(videoDatabase, payload.isNewVideo, t)

    return { videoDatabase, videoPublished }
  })

  if (payload.isNewVideo) Notifier.Instance.notifyOnNewVideoIfNeeded(videoDatabase)
  if (videoPublished) Notifier.Instance.notifyOnVideoPublishedAfterTranscoding(videoDatabase)
}

async function onNewWebTorrentFileResolution (
  video: MVideoUUID,
  user: MUserId,
  payload?: NewResolutionTranscodingPayload | MergeAudioTranscodingPayload
) {
  await publishAndFederateIfNeeded(video)

  await createHlsJobIfEnabled(user, Object.assign({}, payload, { copyCodecs: true }))
}

// ---------------------------------------------------------------------------

export {
  processVideoTranscoding,
  onNewWebTorrentFileResolution
}

// ---------------------------------------------------------------------------

async function createHlsJobIfEnabled (user: MUserId, payload: {
  videoUUID: string
  resolution: number
  isPortraitMode?: boolean
  copyCodecs: boolean
}) {
  if (!payload || CONFIG.TRANSCODING.HLS.ENABLED !== true) return

  const jobOptions = {
    priority: JOB_PRIORITY.TRANSCODING.NEW_RESOLUTION + await getJobTranscodingPriorityMalus(user)
  }

  const hlsTranscodingPayload: HLSTranscodingPayload = {
    type: 'new-resolution-to-hls',
    videoUUID: payload.videoUUID,
    resolution: payload.resolution,
    isPortraitMode: payload.isPortraitMode,
    copyCodecs: payload.copyCodecs
  }

  return JobQueue.Instance.createJobWithPromise({ type: 'video-transcoding', payload: hlsTranscodingPayload }, jobOptions)
}

async function createLowerResolutionsJobs (
  video: MVideoFullLight,
  user: MUserId,
  videoFileResolution: number,
  isPortraitMode: boolean
) {
  // Create transcoding jobs if there are enabled resolutions
  const resolutionsEnabled = computeResolutionsToTranscode(videoFileResolution, 'vod')
  logger.info(
    'Resolutions computed for video %s and origin file resolution of %d.', video.uuid, videoFileResolution,
    { resolutions: resolutionsEnabled }
  )

  if (resolutionsEnabled.length === 0) {
    logger.info('No transcoding jobs created for video %s (no resolutions).', video.uuid)

    return false
  }

  for (const resolution of resolutionsEnabled) {
    let dataInput: VideoTranscodingPayload

    if (CONFIG.TRANSCODING.WEBTORRENT.ENABLED) {
      // WebTorrent will create subsequent HLS job
      dataInput = {
        type: 'new-resolution-to-webtorrent',
        videoUUID: video.uuid,
        resolution,
        isPortraitMode
      }
    } else if (CONFIG.TRANSCODING.HLS.ENABLED) {
      dataInput = {
        type: 'new-resolution-to-hls',
        videoUUID: video.uuid,
        resolution,
        isPortraitMode,
        copyCodecs: false
      }
    }

    const jobOptions = {
      priority: JOB_PRIORITY.TRANSCODING.NEW_RESOLUTION + await getJobTranscodingPriorityMalus(user)
    }

    JobQueue.Instance.createJob({ type: 'video-transcoding', payload: dataInput }, jobOptions)
  }

  logger.info('Transcoding jobs created for uuid %s.', video.uuid, { resolutionsEnabled })

  return true
}
