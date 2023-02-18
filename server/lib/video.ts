import { UploadFiles } from 'express'
import memoizee from 'memoizee'
import { Transaction } from 'sequelize/types'
import { CONFIG } from '@server/initializers/config'
import { DEFAULT_AUDIO_RESOLUTION, JOB_PRIORITY, MEMOIZE_LENGTH, MEMOIZE_TTL } from '@server/initializers/constants'
import { TagModel } from '@server/models/video/tag'
import { VideoModel } from '@server/models/video/video'
import { VideoJobInfoModel } from '@server/models/video/video-job-info'
import { FilteredModelAttributes } from '@server/types'
import { MThumbnail, MUserId, MVideoFile, MVideoFullLight, MVideoTag, MVideoThumbnail, MVideoUUID } from '@server/types/models'
import { ManageVideoTorrentPayload, ThumbnailType, VideoCreate, VideoPrivacy, VideoState, VideoTranscodingPayload } from '@shared/models'
import { CreateJobArgument, CreateJobOptions, JobQueue } from './job-queue/job-queue'
import { updateVideoMiniatureFromExisting } from './thumbnail'
import { moveFilesIfPrivacyChanged } from './video-privacy'

function buildLocalVideoFromReq (videoInfo: VideoCreate, channelId: number): FilteredModelAttributes<VideoModel> {
  return {
    name: videoInfo.name,
    remote: false,
    category: videoInfo.category,
    licence: videoInfo.licence ?? CONFIG.DEFAULTS.PUBLISH.LICENCE,
    language: videoInfo.language,
    commentsEnabled: videoInfo.commentsEnabled ?? CONFIG.DEFAULTS.PUBLISH.COMMENTS_ENABLED,
    downloadEnabled: videoInfo.downloadEnabled ?? CONFIG.DEFAULTS.PUBLISH.DOWNLOAD_ENABLED,
    waitTranscoding: videoInfo.waitTranscoding || false,
    nsfw: videoInfo.nsfw || false,
    description: videoInfo.description,
    support: videoInfo.support,
    privacy: videoInfo.privacy || VideoPrivacy.PRIVATE,
    channelId,
    originallyPublishedAt: videoInfo.originallyPublishedAt
      ? new Date(videoInfo.originallyPublishedAt)
      : null
  }
}

async function buildVideoThumbnailsFromReq (options: {
  video: MVideoThumbnail
  files: UploadFiles
  fallback: (type: ThumbnailType) => Promise<MThumbnail>
  automaticallyGenerated?: boolean
}) {
  const { video, files, fallback, automaticallyGenerated } = options

  const promises = [
    {
      type: ThumbnailType.MINIATURE,
      fieldName: 'thumbnailfile'
    },
    {
      type: ThumbnailType.PREVIEW,
      fieldName: 'previewfile'
    }
  ].map(p => {
    const fields = files?.[p.fieldName]

    if (fields) {
      return updateVideoMiniatureFromExisting({
        inputPath: fields[0].path,
        video,
        type: p.type,
        automaticallyGenerated: automaticallyGenerated || false
      })
    }

    return fallback(p.type)
  })

  return Promise.all(promises)
}

// ---------------------------------------------------------------------------

async function setVideoTags (options: {
  video: MVideoTag
  tags: string[]
  transaction?: Transaction
}) {
  const { video, tags, transaction } = options

  const internalTags = tags || []
  const tagInstances = await TagModel.findOrCreateTags(internalTags, transaction)

  await video.$set('Tags', tagInstances, { transaction })
  video.Tags = tagInstances
}

// ---------------------------------------------------------------------------

async function buildOptimizeOrMergeAudioJob (options: {
  video: MVideoUUID
  videoFile: MVideoFile
  user?: MUserId
  isNewVideo?: boolean // Default true
}) {
  const { video, videoFile, user, isNewVideo } = options

  let payload: VideoTranscodingPayload

  if (videoFile.isAudio()) {
    payload = {
      type: 'merge-audio-to-webtorrent',
      resolution: DEFAULT_AUDIO_RESOLUTION,
      videoUUID: video.uuid,
      createHLSIfNeeded: true,
      isNewVideo
    }
  } else {
    payload = {
      type: 'optimize-to-webtorrent',
      videoUUID: video.uuid,
      isNewVideo
    }
  }

  await VideoJobInfoModel.increaseOrCreate(payload.videoUUID, 'pendingTranscode')

  return {
    type: 'video-transcoding' as 'video-transcoding',
    priority: await getTranscodingJobPriority(user),
    payload
  }
}

async function buildTranscodingJob (payload: VideoTranscodingPayload, options: CreateJobOptions = {}) {
  await VideoJobInfoModel.increaseOrCreate(payload.videoUUID, 'pendingTranscode')

  return { type: 'video-transcoding' as 'video-transcoding', payload, ...options }
}

async function getTranscodingJobPriority (user?: MUserId) {
  if (!user) return JOB_PRIORITY.TRANSCODING

  const now = new Date()
  const lastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)

  const videoUploadedByUser = await VideoModel.countVideosUploadedByUserSince(user.id, lastWeek)

  return JOB_PRIORITY.TRANSCODING + videoUploadedByUser
}

// ---------------------------------------------------------------------------

async function buildMoveToObjectStorageJob (options: {
  video: MVideoUUID
  previousVideoState: VideoState
  isNewVideo?: boolean // Default true
}) {
  const { video, previousVideoState, isNewVideo = true } = options

  await VideoJobInfoModel.increaseOrCreate(video.uuid, 'pendingMove')

  return {
    type: 'move-to-object-storage' as 'move-to-object-storage',
    payload: {
      videoUUID: video.uuid,
      isNewVideo,
      previousVideoState
    }
  }
}

// ---------------------------------------------------------------------------

async function getVideoDuration (videoId: number | string) {
  const video = await VideoModel.load(videoId)

  const duration = video.isLive
    ? undefined
    : video.duration

  return { duration, isLive: video.isLive }
}

const getCachedVideoDuration = memoizee(getVideoDuration, {
  promise: true,
  max: MEMOIZE_LENGTH.VIDEO_DURATION,
  maxAge: MEMOIZE_TTL.VIDEO_DURATION
})

// ---------------------------------------------------------------------------

async function addVideoJobsAfterUpload (video: MVideoFullLight, videoFile: MVideoFile, user?: MUserId, previousVideoState?: VideoState) {
  return JobQueue.Instance.createSequentialJobFlow(
    {
      type: 'manage-video-torrent' as 'manage-video-torrent',
      payload: {
        videoId: video.id,
        videoFileId: videoFile.id,
        action: previousVideoState ? 'update-video-file' : 'create'
      }
    },

    !previousVideoState && {
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
        isNewVideo: !previousVideoState
      }
    },

    video.state === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE
      ? await buildMoveToObjectStorageJob({ video, previousVideoState })
      : undefined,

    video.state === VideoState.TO_TRANSCODE
      ? await buildOptimizeOrMergeAudioJob({ video, videoFile, user })
      : undefined
  )
}
async function addVideoJobsAfterUpdate (options: {
  video: MVideoFullLight
  isNewVideo: boolean

  nameChanged: boolean
  oldPrivacy: VideoPrivacy
}) {
  const { video, nameChanged, oldPrivacy, isNewVideo } = options
  const jobs: CreateJobArgument[] = []

  const filePathChanged = await moveFilesIfPrivacyChanged(video, oldPrivacy)

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
      isNewVideo
    }
  })

  const wasConfidentialVideo = new Set([ VideoPrivacy.PRIVATE, VideoPrivacy.UNLISTED, VideoPrivacy.INTERNAL ]).has(oldPrivacy)

  if (wasConfidentialVideo) {
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

// ---------------------------------------------------------------------------

export {
  buildLocalVideoFromReq,
  buildVideoThumbnailsFromReq,
  setVideoTags,
  buildOptimizeOrMergeAudioJob,
  buildTranscodingJob,
  buildMoveToObjectStorageJob,
  getTranscodingJobPriority,
  addVideoJobsAfterUpload,
  addVideoJobsAfterUpdate,
  getCachedVideoDuration
}
