import {
  ManageVideoTorrentPayload,
  VideoFileStream,
  VideoPrivacy,
  VideoPrivacyType,
  VideoState,
  VideoStateType
} from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideo, MVideoFile, MVideoFullLight, MVideoUUID } from '@server/types/models/index.js'
import { CreateJobArgument, CreateJobOptions, JobQueue } from './job-queue/job-queue.js'
import { VideoStoryboardJobHandler } from './runners/index.js'
import { createTranscriptionTaskIfNeeded } from './video-captions.js'
import { moveFilesIfPrivacyChanged } from './video-privacy.js'

export async function buildMoveVideoJob (options: {
  video: MVideoUUID
  previousVideoState: VideoStateType
  type: 'move-to-object-storage' | 'move-to-file-system'
  isNewVideo?: boolean // Default true
}) {
  const { video, previousVideoState, isNewVideo = true, type } = options

  await VideoJobInfoModel.increaseOrCreate(video.uuid, 'pendingMove')

  return {
    type,
    payload: {
      videoUUID: video.uuid,
      isNewVideo,
      previousVideoState
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
    return {
      type: 'federate-video' as 'federate-video',
      payload: {
        videoUUID: video.uuid,
        isNewVideoForFederation: false
      }
    }
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

  const jobs: (CreateJobArgument & CreateJobOptions)[] = [
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

    {
      type: 'federate-video' as 'federate-video',
      payload: {
        videoUUID: video.uuid,
        isNewVideoForFederation: true
      }
    }
  ]

  if (video.state === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE) {
    jobs.push(await buildMoveVideoJob({ video, previousVideoState: undefined, type: 'move-to-object-storage' }))
  }

  if (video.state === VideoState.TO_TRANSCODE) {
    jobs.push({
      type: 'transcoding-job-builder' as 'transcoding-job-builder',
      payload: {
        videoUUID: video.uuid,
        optimizeJob: {
          isNewVideo: true
        }
      }
    })
  }

  await JobQueue.Instance.createSequentialJobFlow(...jobs)

  await addRemoteStoryboardJobIfNeeded(video)

  if (generateTranscription === true) {
    await createTranscriptionTaskIfNeeded(video)
  }
}

export async function addVideoJobsAfterUpdate (options: {
  video: MVideoFullLight
  isNewVideoForFederation: boolean

  nameChanged: boolean
  oldPrivacy: VideoPrivacyType
}) {
  const { video, nameChanged, oldPrivacy, isNewVideoForFederation } = options
  const jobs: CreateJobArgument[] = []

  const filePathChanged = await moveFilesIfPrivacyChanged(video, oldPrivacy)
  const hls = video.getHLSPlaylist()

  if (filePathChanged && hls) {
    hls.assignP2PMediaLoaderInfoHashes(video, hls.VideoFiles)
    await hls.save()
  }

  if (!video.isLive && (nameChanged || filePathChanged)) {
    for (const file of (video.VideoFiles || [])) {
      const payload: ManageVideoTorrentPayload = { action: 'update-metadata', videoId: video.id, videoFileId: file.id }

      jobs.push({ type: 'manage-video-torrent', payload })
    }

    const hls = video.getHLSPlaylist()

    for (const file of (hls?.VideoFiles || [])) {
      const payload: ManageVideoTorrentPayload = { action: 'update-metadata', streamingPlaylistId: hls.id, videoFileId: file.id }

      jobs.push({ type: 'manage-video-torrent', payload })
    }
  }

  jobs.push({
    type: 'federate-video',
    payload: {
      videoUUID: video.uuid,
      isNewVideoForFederation
    }
  })

  const wasConfidentialVideoForNotification = new Set<VideoPrivacyType>([
    VideoPrivacy.PRIVATE,
    VideoPrivacy.UNLISTED
  ]).has(oldPrivacy)

  if (wasConfidentialVideoForNotification) {
    jobs.push({
      type: 'notify',
      payload: {
        action: 'new-video',
        videoUUID: video.uuid
      }
    })
  }

  return JobQueue.Instance.createSequentialJobFlow(...jobs)
}
