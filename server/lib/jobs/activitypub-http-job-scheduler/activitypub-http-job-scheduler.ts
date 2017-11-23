import { JobScheduler, JobHandler } from '../job-scheduler'

import * as activitypubHttpBroadcastHandler from './activitypub-http-broadcast-handler'
import * as activitypubHttpUnicastHandler from './activitypub-http-unicast-handler'
import * as activitypubHttpFetcherHandler from './activitypub-http-fetcher-handler'
import { JobCategory } from '../../../../shared'
import { ACTIVITY_PUB } from '../../../initializers/constants'
import { logger } from '../../../helpers/logger'

type ActivityPubHttpPayload = {
  uris: string[]
  signatureAccountId?: number
  body?: any
  attemptNumber?: number
}

const jobHandlers: { [ handlerName: string ]: JobHandler<ActivityPubHttpPayload, void> } = {
  activitypubHttpBroadcastHandler,
  activitypubHttpUnicastHandler,
  activitypubHttpFetcherHandler
}
const jobCategory: JobCategory = 'activitypub-http'

const activitypubHttpJobScheduler = new JobScheduler(jobCategory, jobHandlers)

function maybeRetryRequestLater (err: Error, payload: ActivityPubHttpPayload, uri: string) {
  logger.warn('Cannot make request to %s.', uri, err)

  let attemptNumber = payload.attemptNumber || 1
  attemptNumber += 1

  if (attemptNumber < ACTIVITY_PUB.MAX_HTTP_ATTEMPT) {
    logger.debug('Retrying request to %s (attempt %d/%d).', uri, attemptNumber, ACTIVITY_PUB.MAX_HTTP_ATTEMPT, err)

    const newPayload = Object.assign(payload, {
      uris: [ uri ],
      attemptNumber
    })
    return activitypubHttpJobScheduler.createJob(undefined, 'activitypubHttpUnicastHandler', newPayload)
  }
}

export {
  ActivityPubHttpPayload,
  activitypubHttpJobScheduler,
  maybeRetryRequestLater
}
