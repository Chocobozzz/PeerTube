import { JobScheduler, JobHandler } from '../job-scheduler'

import * as activitypubHttpBroadcastHandler from './activitypub-http-broadcast-handler'
import * as activitypubHttpUnicastHandler from './activitypub-http-unicast-handler'
import { JobCategory } from '../../../../shared'

type ActivityPubHttpPayload = {
  uris: string[]
  signatureAccountId: number
  body: any
}
const jobHandlers: { [ handlerName: string ]: JobHandler<ActivityPubHttpPayload, void> } = {
  activitypubHttpBroadcastHandler,
  activitypubHttpUnicastHandler
}
const jobCategory: JobCategory = 'activitypub-http'

const activitypubHttpJobScheduler = new JobScheduler(jobCategory, jobHandlers)

export {
  ActivityPubHttpPayload,
  activitypubHttpJobScheduler
}
