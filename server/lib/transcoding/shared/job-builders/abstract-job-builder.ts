
import { MUserId, MVideoFile, MVideoFullLight } from '@server/types/models'

export abstract class AbstractJobBuilder {

  abstract createOptimizeOrMergeAudioJobs (options: {
    video: MVideoFullLight
    videoFile: MVideoFile
    isNewVideo: boolean
    user: MUserId
    videoFileAlreadyLocked: boolean
  }): Promise<any>

  abstract createTranscodingJobs (options: {
    transcodingType: 'hls' | 'webtorrent'
    video: MVideoFullLight
    resolutions: number[]
    isNewVideo: boolean
    user: MUserId | null
  }): Promise<any>
}
