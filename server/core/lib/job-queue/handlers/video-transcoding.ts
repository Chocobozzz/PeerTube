import {
  HLSTranscodingPayload,
  MergeAudioTranscodingPayload,
  NewWebVideoResolutionTranscodingPayload,
  OptimizeTranscodingPayload,
  VideoTranscodingPayload
} from '@peertube/peertube-models'
import { isVideoMissHLSAudio } from '@server/lib/runners/job-handlers/shared/utils.js'
import { onTranscodingEnded } from '@server/lib/transcoding/ended-transcoding.js'
import { generateHlsPlaylistResolution } from '@server/lib/transcoding/hls-transcoding.js'
import { mergeAudioVideofile, optimizeOriginalVideofile, transcodeNewWebVideoResolution } from '@server/lib/transcoding/web-transcoding.js'
import { removeAllWebVideoFiles } from '@server/lib/video-file.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { moveToFailedTranscodingState } from '@server/lib/video-state.js'
import { UserModel } from '@server/models/user/user.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { MUser, MUserId, MVideoFullLight } from '@server/types/models/index.js'
import { Job } from 'bullmq'
import { logger, loggerTagsFactory } from '../../../helpers/logger.js'
import { VideoModel } from '../../../models/video/video.js'

type HandlerFunction = (job: Job, payload: VideoTranscodingPayload, video: MVideoFullLight, user: MUser) => Promise<void>

const handlers: { [ id in VideoTranscodingPayload['type'] ]: HandlerFunction } = {
  'new-resolution-to-hls': handleHLSJob,
  'new-resolution-to-web-video': handleNewWebVideoResolutionJob,
  'merge-audio-to-web-video': handleWebVideoMergeAudioJob,
  'optimize-to-web-video': handleWebVideoOptimizeJob
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

async function handleWebVideoMergeAudioJob (job: Job, payload: MergeAudioTranscodingPayload, video: MVideoFullLight, user: MUserId) {
  logger.info('Handling merge audio transcoding job for %s.', video.uuid, lTags(video.uuid), { payload })

  await mergeAudioVideofile({ video, resolution: payload.resolution, fps: payload.fps, job })

  logger.info('Merge audio transcoding job for %s ended.', video.uuid, lTags(video.uuid), { payload })

  await onTranscodingEnded({ isNewVideo: payload.isNewVideo, moveVideoToNextState: !payload.hasChildren, video })
}

async function handleWebVideoOptimizeJob (job: Job, payload: OptimizeTranscodingPayload, video: MVideoFullLight, user: MUserId) {
  logger.info('Handling optimize transcoding job for %s.', video.uuid, lTags(video.uuid), { payload })

  await optimizeOriginalVideofile({ video, quickTranscode: payload.quickTranscode, job })

  logger.info('Optimize transcoding job for %s ended.', video.uuid, lTags(video.uuid), { payload })

  await onTranscodingEnded({ isNewVideo: payload.isNewVideo, moveVideoToNextState: !payload.hasChildren, video })
}

// ---------------------------------------------------------------------------

async function handleNewWebVideoResolutionJob (job: Job, payload: NewWebVideoResolutionTranscodingPayload, video: MVideoFullLight) {
  logger.info('Handling Web Video transcoding job for %s.', video.uuid, lTags(video.uuid), { payload })

  await transcodeNewWebVideoResolution({ video, resolution: payload.resolution, fps: payload.fps, job })

  logger.info('Web Video transcoding job for %s ended.', video.uuid, lTags(video.uuid), { payload })

  await onTranscodingEnded({ isNewVideo: payload.isNewVideo, moveVideoToNextState: !payload.hasChildren, video })
}

// ---------------------------------------------------------------------------

async function handleHLSJob (job: Job, payload: HLSTranscodingPayload, videoArg: MVideoFullLight) {
  logger.info('Handling HLS transcoding job for %s.', videoArg.uuid, lTags(videoArg.uuid), { payload })

  const inputFileMutexReleaser = await VideoPathManager.Instance.lockFiles(videoArg.uuid)
  let video: MVideoFullLight

  try {
    video = await VideoModel.loadFull(videoArg.uuid)

    const { videoFile, separatedAudioFile } = video.getMaxQualityAudioAndVideoFiles()

    const videoFileInputs = payload.copyCodecs
      ? [ video.getWebVideoFileMinResolution(payload.resolution) ]
      : [ videoFile, separatedAudioFile ].filter(v => !!v)

    await VideoPathManager.Instance.makeAvailableVideoFiles(videoFileInputs, ([ videoPath, separatedAudioPath ]) => {
      return generateHlsPlaylistResolution({
        video,

        videoInputPath: videoPath,
        separatedAudioInputPath: separatedAudioPath,

        inputFileMutexReleaser,
        resolution: payload.resolution,
        fps: payload.fps,
        copyCodecs: payload.copyCodecs,
        separatedAudio: payload.separatedAudio,
        job
      })
    })
  } finally {
    inputFileMutexReleaser()
  }

  logger.info('HLS transcoding job for %s ended.', video.uuid, lTags(video.uuid), { payload })

  if (payload.deleteWebVideoFiles === true) {
    logger.info('Removing Web Video files of %s now we have a HLS version of it.', video.uuid, lTags(video.uuid))

    await removeAllWebVideoFiles(video)
  }

  let moveVideoToNextState = !payload.hasChildren

  // Splitted audio, wait audio generation before moving the video in its next state
  if (await isVideoMissHLSAudio({ resolution: payload.resolution, separatedAudio: payload.separatedAudio, videoId: videoArg.uuid })) {
    moveVideoToNextState = false
  }

  await onTranscodingEnded({ isNewVideo: payload.isNewVideo, moveVideoToNextState, video })
}
