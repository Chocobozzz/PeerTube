import { MEMOIZE_LENGTH, MEMOIZE_TTL } from '@server/initializers/constants.js'
import { TagModel } from '@server/models/video/tag.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideoTag } from '@server/types/models/index.js'
import memoizee from 'memoizee'
import { Transaction } from 'sequelize'

// ---------------------------------------------------------------------------

export async function setVideoTags (options: {
  video: MVideoTag
  tags: string[]
  transaction?: Transaction
}) {
  const { video, tags, transaction } = options

  const internalTags = tags || []
  const tagInstances = await TagModel.findOrCreateMultiple({ tags: internalTags, transaction })

  await video.$set('Tags', tagInstances, { transaction })
  video.Tags = tagInstances
}

// ---------------------------------------------------------------------------

async function getVideoDuration (videoId: number | string) {
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
