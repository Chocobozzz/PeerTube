import { JobScheduler, JobHandler } from '../job-scheduler'

import * as videoFileOptimizer from './video-file-optimizer-handler'
import * as videoFileTranscoder from './video-file-transcoder-handler'
import { JobCategory } from '../../../../shared'

const jobHandlers: { [ handlerName: string ]: JobHandler<any> } = {
  videoFileOptimizer,
  videoFileTranscoder
}
const jobCategory: JobCategory = 'transcoding'

const transcodingJobScheduler = new JobScheduler(jobCategory, jobHandlers)

export {
  transcodingJobScheduler
}
