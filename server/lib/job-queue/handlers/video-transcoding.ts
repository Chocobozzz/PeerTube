import { Job } from 'bullmq'
import { TranscodeVODOptionsType } from '@server/helpers/ffmpeg'
import { Hooks } from '@server/lib/plugins/hooks'
import { buildTranscodingJob, getTranscodingJobPriority } from '@server/lib/video'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { moveToFailedTranscodingState, moveToNextState } from '@server/lib/video-state'
import { UserModel } from '@server/models/user/user'
import { VideoJobInfoModel } from '@server/models/video/video-job-info'
import { MUser, MUserId, MVideo, MVideoFullLight, MVideoWithFile } from '@server/types/models'
import { pick } from '@shared/core-utils'
import {
  HLSTranscodingPayload,
  MergeAudioTranscodingPayload,
  NewWebTorrentResolutionTranscodingPayload,
  OptimizeTranscodingPayload,
  VideoResolution,
  VideoTranscodingPayload
} from '@shared/models'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { computeResolutionsToTranscode } from '../../../helpers/ffmpeg'
import { logger, loggerTagsFactory } from '../../../helpers/logger'
import { CONFIG } from '../../../initializers/config'
import { VideoModel } from '../../../models/video/video'
import {
  generateHlsPlaylistResolution,
  mergeAudioVideofile,
  optimizeOriginalVideofile,
  transcodeNewWebTorrentResolution
} from '../../transcoding/transcoding'
import { JobQueue } from '../job-queue'

type HandlerFunction = (job: Job, payload: VideoTranscodingPayload, video: MVideoFullLight, user: MUser) => Promise<void>

const handlers: { [ id in VideoTranscodingPayload['type'] ]: HandlerFunction } = {
  'new-resolution-to-hls': handleHLSJob,
  'new-resolution-to-webtorrent': handleNewWebTorrentResolutionJob,
  'merge-audio-to-webtorrent': handleWebTorrentMergeAudioJob,
  'optimize-to-webtorrent': handleWebTorrentOptimizeJob
}

const lTags = loggerTagsFactory('transcoding')

async function processVideoTranscoding (job: Job) {
  const payload = job.data as VideoTranscodingPayload
  logger.info('Processing transcoding job %s.', job.id, lTags(payload.videoUUID))

  const video = await VideoModel.loadFull(payload.videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info('Do not process job %d, video does not exist.', job.id, lTags(payload.videoUUID))
    return undefined
  }

  const user = await UserModel.loadByChannelActorId(video.VideoChannel.actorId)

  const handler = handlers[payload.type]

  if (!handler) {
    await moveToFailedTranscodingState(video)
    await VideoJobInfoModel.decrease(video.uuid, 'pendingTranscode')

    throw new Error('Cannot find transcoding handler for ' + payload.type)
  }

  try {
    await handler(job, payload, video, user)
  } catch (error) {
    await moveToFailedTranscodingState(video)

    await VideoJobInfoModel.decrease(video.uuid, 'pendingTranscode')

    throw error
  }

  return video
}

// ---------------------------------------------------------------------------

export {
  processVideoTranscoding
}

// ---------------------------------------------------------------------------
// Job handlers
// ---------------------------------------------------------------------------

async function handleHLSJob (job: Job, payload: HLSTranscodingPayload, video: MVideoFullLight, user: MUser) {
  logger.info('Handling HLS transcoding job for %s.', video.uuid, lTags(video.uuid))

  const videoFileInput = payload.copyCodecs
    ? video.getWebTorrentFile(payload.resolution)
    : video.getMaxQualityFile()

  const videoOrStreamingPlaylist = videoFileInput.getVideoOrStreamingPlaylist()

  await VideoPathManager.Instance.makeAvailableVideoFile(videoFileInput.withVideoOrPlaylist(videoOrStreamingPlaylist), videoInputPath => {
    return generateHlsPlaylistResolution({
      video,
      videoInputPath,
      resolution: payload.resolution,
      copyCodecs: payload.copyCodecs,
      job
    })
  })

  logger.info('HLS transcoding job for %s ended.', video.uuid, lTags(video.uuid))

  await onHlsPlaylistGeneration(video, user, payload)
}

async function handleNewWebTorrentResolutionJob (
  job: Job,
  payload: NewWebTorrentResolutionTranscodingPayload,
  video: MVideoFullLight,
  user: MUserId
) {
  logger.info('Handling WebTorrent transcoding job for %s.', video.uuid, lTags(video.uuid))

  await transcodeNewWebTorrentResolution({ video, resolution: payload.resolution, job })

  logger.info('WebTorrent transcoding job for %s ended.', video.uuid, lTags(video.uuid))

  await onNewWebTorrentFileResolution(video, user, payload)
}

async function handleWebTorrentMergeAudioJob (job: Job, payload: MergeAudioTranscodingPayload, video: MVideoFullLight, user: MUserId) {
  logger.info('Handling merge audio transcoding job for %s.', video.uuid, lTags(video.uuid))

  await mergeAudioVideofile({ video, resolution: payload.resolution, job })

  logger.info('Merge audio transcoding job for %s ended.', video.uuid, lTags(video.uuid))

  await onVideoFirstWebTorrentTranscoding(video, payload, 'video', user)
}

async function handleWebTorrentOptimizeJob (job: Job, payload: OptimizeTranscodingPayload, video: MVideoFullLight, user: MUserId) {
  logger.info('Handling optimize transcoding job for %s.', video.uuid, lTags(video.uuid))

  const { transcodeType } = await optimizeOriginalVideofile({ video, inputVideoFile: video.getMaxQualityFile(), job })

  logger.info('Optimize transcoding job for %s ended.', video.uuid, lTags(video.uuid))

  await onVideoFirstWebTorrentTranscoding(video, payload, transcodeType, user)
}

// ---------------------------------------------------------------------------

async function onHlsPlaylistGeneration (video: MVideoFullLight, user: MUser, payload: HLSTranscodingPayload) {
  if (payload.isMaxQuality && payload.autoDeleteWebTorrentIfNeeded && CONFIG.TRANSCODING.WEBTORRENT.ENABLED === false) {
    // Remove webtorrent files if not enabled
    for (const file of video.VideoFiles) {
      await video.removeWebTorrentFile(file)
      await file.destroy()
    }

    video.VideoFiles = []

    // Create HLS new resolution jobs
    await createLowerResolutionsJobs({
      video,
      user,
      videoFileResolution: payload.resolution,
      hasAudio: payload.hasAudio,
      isNewVideo: payload.isNewVideo ?? true,
      type: 'hls'
    })
  }

  await VideoJobInfoModel.decrease(video.uuid, 'pendingTranscode')
  await retryTransactionWrapper(moveToNextState, { video, isNewVideo: payload.isNewVideo })
}

async function onVideoFirstWebTorrentTranscoding (
  videoArg: MVideoWithFile,
  payload: OptimizeTranscodingPayload | MergeAudioTranscodingPayload,
  transcodeType: TranscodeVODOptionsType,
  user: MUserId
) {
  const { resolution, audioStream } = await videoArg.probeMaxQualityFile()

  // Maybe the video changed in database, refresh it
  const videoDatabase = await VideoModel.loadFull(videoArg.uuid)
  // Video does not exist anymore
  if (!videoDatabase) return undefined

  // Generate HLS version of the original file
  const originalFileHLSPayload = {
    ...payload,

    hasAudio: !!audioStream,
    resolution: videoDatabase.getMaxQualityFile().resolution,
    // If we quick transcoded original file, force transcoding for HLS to avoid some weird playback issues
    copyCodecs: transcodeType !== 'quick-transcode',
    isMaxQuality: true
  }
  const hasHls = await createHlsJobIfEnabled(user, originalFileHLSPayload)
  const hasNewResolutions = await createLowerResolutionsJobs({
    video: videoDatabase,
    user,
    videoFileResolution: resolution,
    hasAudio: !!audioStream,
    type: 'webtorrent',
    isNewVideo: payload.isNewVideo ?? true
  })

  await VideoJobInfoModel.decrease(videoDatabase.uuid, 'pendingTranscode')

  // Move to next state if there are no other resolutions to generate
  if (!hasHls && !hasNewResolutions) {
    await retryTransactionWrapper(moveToNextState, { video: videoDatabase, isNewVideo: payload.isNewVideo })
  }
}

async function onNewWebTorrentFileResolution (
  video: MVideo,
  user: MUserId,
  payload: NewWebTorrentResolutionTranscodingPayload | MergeAudioTranscodingPayload
) {
  if (payload.createHLSIfNeeded) {
    await createHlsJobIfEnabled(user, { hasAudio: true, copyCodecs: true, isMaxQuality: false, ...payload })
  }

  await VideoJobInfoModel.decrease(video.uuid, 'pendingTranscode')

  await retryTransactionWrapper(moveToNextState, { video, isNewVideo: payload.isNewVideo })
}

// ---------------------------------------------------------------------------

async function createHlsJobIfEnabled (user: MUserId, payload: {
  videoUUID: string
  resolution: number
  hasAudio: boolean
  copyCodecs: boolean
  isMaxQuality: boolean
  isNewVideo?: boolean
}) {
  if (!payload || CONFIG.TRANSCODING.ENABLED !== true || CONFIG.TRANSCODING.HLS.ENABLED !== true) return false

  const jobOptions = {
    priority: await getTranscodingJobPriority(user)
  }

  const hlsTranscodingPayload: HLSTranscodingPayload = {
    type: 'new-resolution-to-hls',
    autoDeleteWebTorrentIfNeeded: true,

    ...pick(payload, [ 'videoUUID', 'resolution', 'copyCodecs', 'isMaxQuality', 'isNewVideo', 'hasAudio' ])
  }

  await JobQueue.Instance.createJob(await buildTranscodingJob(hlsTranscodingPayload, jobOptions))

  return true
}

async function createLowerResolutionsJobs (options: {
  video: MVideoFullLight
  user: MUserId
  videoFileResolution: number
  hasAudio: boolean
  isNewVideo: boolean
  type: 'hls' | 'webtorrent'
}) {
  const { video, user, videoFileResolution, isNewVideo, hasAudio, type } = options

  // Create transcoding jobs if there are enabled resolutions
  const resolutionsEnabled = await Hooks.wrapObject(
    computeResolutionsToTranscode({ input: videoFileResolution, type: 'vod', includeInput: false, strictLower: true }),
    'filter:transcoding.auto.resolutions-to-transcode.result',
    options
  )

  const resolutionCreated: string[] = []

  for (const resolution of resolutionsEnabled) {
    if (resolution === VideoResolution.H_NOVIDEO && hasAudio === false) continue

    let dataInput: VideoTranscodingPayload

    if (CONFIG.TRANSCODING.WEBTORRENT.ENABLED && type === 'webtorrent') {
      // WebTorrent will create subsequent HLS job
      dataInput = {
        type: 'new-resolution-to-webtorrent',
        videoUUID: video.uuid,
        resolution,
        hasAudio,
        createHLSIfNeeded: true,
        isNewVideo
      }

      resolutionCreated.push('webtorrent-' + resolution)
    }

    if (CONFIG.TRANSCODING.HLS.ENABLED && type === 'hls') {
      dataInput = {
        type: 'new-resolution-to-hls',
        videoUUID: video.uuid,
        resolution,
        hasAudio,
        copyCodecs: false,
        isMaxQuality: false,
        autoDeleteWebTorrentIfNeeded: true,
        isNewVideo
      }

      resolutionCreated.push('hls-' + resolution)
    }

    if (!dataInput) continue

    const jobOptions = {
      priority: await getTranscodingJobPriority(user)
    }

    await JobQueue.Instance.createJob(await buildTranscodingJob(dataInput, jobOptions))
  }

  if (resolutionCreated.length === 0) {
    logger.info('No transcoding jobs created for video %s (no resolutions).', video.uuid, lTags(video.uuid))

    return false
  }

  logger.info(
    'New resolutions %s transcoding jobs created for video %s and origin file resolution of %d.', type, video.uuid, videoFileResolution,
    { resolutionCreated, ...lTags(video.uuid) }
  )

  return true
}
