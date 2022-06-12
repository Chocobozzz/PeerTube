import { Job } from 'bull'
import { ActivitypubHttpUnicastPayload } from '@shared/models'
import { logger } from '../../../helpers/logger'
import { doRequest } from '../../../helpers/requests'
import { ActorFollowHealthCache } from '../../actor-follow-health-cache'
import { buildGlobalHeaders, buildSignedRequestOptions, computeBody } from './utils/activitypub-http-utils'

async function processActivityPubHttpUnicast (job: Job) {
  logger.info('Processing ActivityPub unicast in job %d.', job.id)

  const payload = job.data as ActivitypubHttpUnicastPayload
  const uri = payload.uri

  const body = await computeBody(payload)
  const httpSignatureOptions = await buildSignedRequestOptions(payload)

  const options = {
    method: 'POST' as 'POST',
    json: body,
    httpSignature: httpSignatureOptions,
    headers: buildGlobalHeaders(body)
  }

  try {
    await doRequest(uri, options)
    ActorFollowHealthCache.Instance.updateActorFollowsHealth([ uri ], [])
  } catch (err) {
    ActorFollowHealthCache.Instance.updateActorFollowsHealth([], [ uri ])

    throw err
  }
}

// ---------------------------------------------------------------------------

export {
  processActivityPubHttpUnicast
}
