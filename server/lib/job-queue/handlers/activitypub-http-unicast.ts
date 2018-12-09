import * as Bull from 'bull'
import { logger } from '../../../helpers/logger'
import { doRequest } from '../../../helpers/requests'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { buildGlobalHeaders, buildSignedRequestOptions, computeBody } from './utils/activitypub-http-utils'
import { JOB_REQUEST_TIMEOUT } from '../../../initializers'

export type ActivitypubHttpUnicastPayload = {
  uri: string
  signatureActorId?: number
  body: any
}

async function processActivityPubHttpUnicast (job: Bull.Job) {
  logger.info('Processing ActivityPub unicast in job %d.', job.id)

  const payload = job.data as ActivitypubHttpUnicastPayload
  const uri = payload.uri

  const body = await computeBody(payload)
  const httpSignatureOptions = await buildSignedRequestOptions(payload)

  const options = {
    method: 'POST',
    uri,
    json: body,
    httpSignature: httpSignatureOptions,
    timeout: JOB_REQUEST_TIMEOUT,
    headers: buildGlobalHeaders(body)
  }

  try {
    await doRequest(options)
    ActorFollowModel.updateActorFollowsScore([ uri ], [], undefined)
  } catch (err) {
    ActorFollowModel.updateActorFollowsScore([], [ uri ], undefined)

    throw err
  }
}

// ---------------------------------------------------------------------------

export {
  processActivityPubHttpUnicast
}
