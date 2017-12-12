import { JobCategory } from '../../../../shared'
import { VideoModel } from '../../../models/video/video'
import { JobHandler, JobScheduler } from '../job-scheduler'

import * as videoFileOptimizer from './video-file-optimizer-handler'
import * as videoFileTranscoder from './video-file-transcoder-handler'

type TranscodingJobPayload = {
  videoUUID: string
  resolution?: number
}
const jobHandlers: { [ handlerName: string ]: JobHandler<TranscodingJobPayload, VideoModel> } = {
  videoFileOptimizer,
  videoFileTranscoder
}
const jobCategory: JobCategory = 'transcoding'

const transcodingJobScheduler = new JobScheduler(jobCategory, jobHandlers)

export {
  TranscodingJobPayload,
  transcodingJobScheduler
}
