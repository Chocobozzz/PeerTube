
import { MUserId, MVideoFile, MVideoFullLight } from '@server/types/models/index.js'

export abstract class AbstractJobBuilder {

  abstract createOptimizeOrMergeAudioJobs (options: {
    video: MVideoFullLight
    videoFile: MVideoFile
    isNewVideo: boolean
    user: MUserId
    videoFileAlreadyLocked: boolean
  }): Promise<any>

  abstract createTranscodingJobs (options: {
    transcodingType: 'hls' | 'webtorrent' | 'web-video' // TODO: remove webtorrent in v7
    video: MVideoFullLight
    resolutions: number[]
    isNewVideo: boolean
    user: MUserId | null
  }): Promise<any>
}
