import { JOB_PRIORITY } from '@server/initializers/constants.js'
import { VideoModel } from '@server/models/video/video.js'
import { MUserId } from '@server/types/models/index.js'

export async function getTranscodingJobPriority (options: {
  user: MUserId
  type: 'vod-required' | 'vod-optional' | 'studio'
}) {
  const { user, type } = options

  const priorityMap = {
    'vod-required': JOB_PRIORITY.REQUIRED_TRANSCODING,
    'vod-optional': JOB_PRIORITY.OPTIONAL_TRANSCODING,
    'studio': JOB_PRIORITY.VIDEO_STUDIO
  }

  const priority = priorityMap[type]

  if (!user) return priority

  const now = new Date()
  const lastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)

  const videoUploadedByUser = await VideoModel.countVideosUploadedByUserSince(user.id, lastWeek)

  return priority + videoUploadedByUser
}
