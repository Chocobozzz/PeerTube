import { UploadFiles } from 'express'
import memoizee from 'memoizee'
import { Transaction } from 'sequelize'
import {
  ManageVideoTorrentPayload,
  ThumbnailType,
  ThumbnailType_Type,
  VideoCreate,
  VideoPrivacy,
  VideoPrivacyType,
  VideoStateType
} from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { MEMOIZE_LENGTH, MEMOIZE_TTL } from '@server/initializers/constants.js'
import { TagModel } from '@server/models/video/tag.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { VideoModel } from '@server/models/video/video.js'
import { FilteredModelAttributes } from '@server/types/index.js'
import { MThumbnail, MVideo, MVideoFullLight, MVideoTag, MVideoThumbnail, MVideoUUID } from '@server/types/models/index.js'
import { CreateJobArgument, JobQueue } from './job-queue/job-queue.js'
import { updateLocalVideoMiniatureFromExisting } from './thumbnail.js'
import { moveFilesIfPrivacyChanged } from './video-privacy.js'

export function buildLocalVideoFromReq (videoInfo: VideoCreate, channelId: number): FilteredModelAttributes<VideoModel> {
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
      : null,

    shortVideo: videoInfo.shortVideo || false
  }
}

export async function buildVideoThumbnailsFromReq (options: {
  video: MVideoThumbnail
  files: UploadFiles
  fallback: (type: ThumbnailType_Type) => Promise<MThumbnail>
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
      return updateLocalVideoMiniatureFromExisting({
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

export async function setVideoTags (options: {
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

export async function buildMoveJob (options: {
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

export function buildStoryboardJobIfNeeded (options: {
  video: MVideo
  federate: boolean
}) {
  const { video, federate } = options

  if (CONFIG.STORYBOARDS.ENABLED) {
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

// ---------------------------------------------------------------------------

export async function getVideoDuration (videoId: number | string) {
  const video = await VideoModel.load(videoId)

  const duration = video.isLive
    ? undefined
    : video.duration

  return { duration, isLive: video.isLive }
}

export const getCachedVideoDuration = memoizee(getVideoDuration, {
  promise: true,
  max: MEMOIZE_LENGTH.VIDEO_DURATION,
  maxAge: MEMOIZE_TTL.VIDEO_DURATION
})

// ---------------------------------------------------------------------------

export async function addVideoJobsAfterUpdate (options: {
  video: MVideoFullLight
  isNewVideoForFederation: boolean

  nameChanged: boolean
  oldPrivacy: VideoPrivacyType
}) {
  const { video, nameChanged, oldPrivacy, isNewVideoForFederation } = options
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
      isNewVideoForFederation
    }
  })

  const wasConfidentialVideo = new Set<VideoPrivacyType>([
    VideoPrivacy.PRIVATE,
    VideoPrivacy.UNLISTED,
    VideoPrivacy.INTERNAL
  ]).has(oldPrivacy)

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
