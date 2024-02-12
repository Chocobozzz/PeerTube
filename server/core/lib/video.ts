import { UploadFiles } from 'express'
import memoizee from 'memoizee'
import { Transaction } from 'sequelize'
import {
  ThumbnailType,
  ThumbnailType_Type,
  VideoCreate,
  VideoPrivacy
} from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { MEMOIZE_LENGTH, MEMOIZE_TTL } from '@server/initializers/constants.js'
import { TagModel } from '@server/models/video/tag.js'
import { VideoModel } from '@server/models/video/video.js'
import { FilteredModelAttributes } from '@server/types/index.js'
import { MThumbnail, MVideoTag, MVideoThumbnail } from '@server/types/models/index.js'
import { updateLocalVideoMiniatureFromExisting } from './thumbnail.js'

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
      : null
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
