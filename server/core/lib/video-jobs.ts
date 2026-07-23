import { VideoFileStream, VideoState, VideoStateType } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideo, MVideoFile, MVideoUUID } from '@server/types/models/index.js'
import { buildNonDuplicatedFederateVideoJob } from './activitypub/videos/federate.js'
import { CreateJobOptions, CreateJobTypeAndPayload, JobQueue } from './job-queue/job-queue.js'
import { VideoStoryboardJobHandler } from './runners/index.js'
import { createTranscriptionTaskIfNeeded } from './video-captions.js'

export async function buildMoveVideoJob (options: {
  video: MVideoUUID
  type: 'move-to-object-storage' | 'move-to-file-system'

  moveVideoState?: {
    previousVideoState: VideoStateType
  }
}) {
  const { video, moveVideoState, type } = options

  await VideoJobInfoModel.increaseOrCreate(video.uuid, 'pendingMove')

  return {
    type,
    payload: {
      videoUUID: video.uuid,
      moveVideoState
    }
  }
}

// ---------------------------------------------------------------------------
// Storyboard
// ---------------------------------------------------------------------------

export async function buildLocalStoryboardJobIfNeeded (options: {
  video: MVideo
  federate: boolean
}) {
  const { video, federate } = options

  const hasVideo = await VideoModel.loadHasStream(video.id, VideoFileStream.VIDEO)

  if (hasVideo && CONFIG.STORYBOARDS.ENABLED && !CONFIG.STORYBOARDS.REMOTE_RUNNERS.ENABLED) {
    return {
      type: 'generate-video-storyboard' as 'generate-video-storyboard',
      payload: {
        videoUUID: video.uuid,
        federate
      }
    }
  }

  if (federate === true) {
    return buildNonDuplicatedFederateVideoJob({ video })
  }

  return undefined
}

export async function addRemoteStoryboardJobIfNeeded (video: MVideo) {
  if (CONFIG.STORYBOARDS.ENABLED !== true) return
  if (CONFIG.STORYBOARDS.REMOTE_RUNNERS.ENABLED !== true) return
  if (!await VideoModel.loadHasStream(video.id, VideoFileStream.VIDEO)) return

  return new VideoStoryboardJobHandler().create({ videoUUID: video.uuid })
}

export async function addLocalOrRemoteStoryboardJobIfNeeded (options: {
  video: MVideo
  federate: boolean
}) {
  const { video, federate } = options

  if (CONFIG.STORYBOARDS.ENABLED !== true) return

  if (CONFIG.STORYBOARDS.REMOTE_RUNNERS.ENABLED === true) {
    await addRemoteStoryboardJobIfNeeded(video)
  } else {
    await JobQueue.Instance.createJob(await buildLocalStoryboardJobIfNeeded({ video, federate }))
  }
}

// ---------------------------------------------------------------------------
// Multiple jobs creation
// ---------------------------------------------------------------------------

export async function addVideoJobsAfterCreation (options: {
  video: MVideo
  videoFile: MVideoFile
  generateTranscription: boolean
}) {
  const { video, videoFile, generateTranscription } = options

  const jobs: (CreateJobTypeAndPayload & CreateJobOptions)[] = [
    {
      type: 'manage-video-torrent' as 'manage-video-torrent',
      payload: {
        videoId: video.id,
        videoFileId: videoFile.id,
        action: 'create'
      }
    },

    await buildLocalStoryboardJobIfNeeded({ video, federate: false }),

    {
      type: 'notify',
      payload: {
        action: 'new-video',
        videoUUID: video.uuid
      }
    },

    buildNonDuplicatedFederateVideoJob({ video })
  ]

  // No transcoding, move the file directly on object storage
  if (video.state === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE) {
    jobs.push(
      await buildMoveVideoJob({
        type: 'move-to-object-storage',
        video,
        moveVideoState: {
          previousVideoState: undefined
        }
      })
    )
  }

  if (video.state === VideoState.TO_TRANSCODE) {
    jobs.push({
      type: 'transcoding-job-builder' as 'transcoding-job-builder',
      payload: {
        videoUUID: video.uuid,
        optimizeJob: {}
      }
    })
  }

  await JobQueue.Instance.createSequentialJobFlow(...jobs)

  await addRemoteStoryboardJobIfNeeded(video)

  if (generateTranscription === true) {
    await createTranscriptionTaskIfNeeded(video)
  }
}
