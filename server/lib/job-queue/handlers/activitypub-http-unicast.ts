import * as kue from 'kue'
import { logger } from '../../../helpers/logger'
import { doRequest } from '../../../helpers/requests'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { buildSignedRequestOptions, computeBody } from './utils/activitypub-http-utils'

export type ActivitypubHttpUnicastPayload = {
  uri: string
  signatureActorId?: number
  body: any
}

async function processActivityPubHttpUnicast (job: kue.Job) {
  logger.info('Processing ActivityPub unicast in job %d.', job.id)

  const payload = job.data as ActivitypubHttpUnicastPayload
  const uri = payload.uri

  const body = await computeBody(payload)
  const httpSignatureOptions = await buildSignedRequestOptions(payload)

  const options = {
    method: 'POST',
    uri,
    json: body,
    httpSignature: httpSignatureOptions
  }

  try {
    await doRequest(options)
    ActorFollowModel.updateActorFollowsScoreAndRemoveBadOnes([ uri ], [], undefined)
  } catch (err) {
    ActorFollowModel.updateActorFollowsScoreAndRemoveBadOnes([], [ uri ], undefined)

    throw err
  }
}

// ---------------------------------------------------------------------------

export {
  processActivityPubHttpUnicast
}
