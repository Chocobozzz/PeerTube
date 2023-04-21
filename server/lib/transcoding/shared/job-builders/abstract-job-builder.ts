
import { JOB_PRIORITY } from '@server/initializers/constants'
import { VideoModel } from '@server/models/video/video'
import { MUserId, MVideoFile, MVideoFullLight } from '@server/types/models'

export abstract class AbstractJobBuilder {

  abstract createOptimizeOrMergeAudioJobs (options: {
    video: MVideoFullLight
    videoFile: MVideoFile
    isNewVideo: boolean
    user: MUserId
  }): Promise<any>

  abstract createTranscodingJobs (options: {
    transcodingType: 'hls' | 'webtorrent'
    video: MVideoFullLight
    resolutions: number[]
    isNewVideo: boolean
    user: MUserId | null
  }): Promise<any>

  protected async getTranscodingJobPriority (options: {
    user: MUserId
    fallback: number
  }) {
    const { user, fallback } = options

    if (!user) return fallback

    const now = new Date()
    const lastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)

    const videoUploadedByUser = await VideoModel.countVideosUploadedByUserSince(user.id, lastWeek)

    return JOB_PRIORITY.TRANSCODING + videoUploadedByUser
  }
}
