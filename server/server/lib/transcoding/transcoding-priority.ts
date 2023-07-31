import { JOB_PRIORITY } from '@server/initializers/constants.js'
import { VideoModel } from '@server/models/video/video.js'
import { MUserId } from '@server/types/models/index.js'

export async function getTranscodingJobPriority (options: {
  user: MUserId
  fallback: number
  type: 'vod' | 'studio'
}) {
  const { user, fallback, type } = options

  if (!user) return fallback

  const now = new Date()
  const lastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)

  const videoUploadedByUser = await VideoModel.countVideosUploadedByUserSince(user.id, lastWeek)

  const base = type === 'vod'
    ? JOB_PRIORITY.TRANSCODING
    : JOB_PRIORITY.VIDEO_STUDIO

  return base + videoUploadedByUser
}
