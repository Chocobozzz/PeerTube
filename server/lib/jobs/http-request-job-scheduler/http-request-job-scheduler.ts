import { JobScheduler, JobHandler } from '../job-scheduler'

import * as httpRequestBroadcastHandler from './http-request-broadcast-handler'
import * as httpRequestUnicastHandler from './http-request-unicast-handler'
import { JobCategory } from '../../../../shared'

const jobHandlers: { [ handlerName: string ]: JobHandler<any> } = {
  httpRequestBroadcastHandler,
  httpRequestUnicastHandler
}
const jobCategory: JobCategory = 'http-request'

const httpRequestJobScheduler = new JobScheduler(jobCategory, jobHandlers)

export {
  httpRequestJobScheduler
}
