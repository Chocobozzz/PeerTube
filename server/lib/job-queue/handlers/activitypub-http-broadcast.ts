import * as kue from 'kue'
import { logger } from '../../../helpers/logger'
import { doRequest } from '../../../helpers/requests'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { buildSignedRequestOptions, computeBody } from './utils/activitypub-http-utils'

export type ActivitypubHttpBroadcastPayload = {
  uris: string[]
  signatureActorId?: number
  body: any
}

async function processActivityPubHttpBroadcast (job: kue.Job) {
  logger.info('Processing ActivityPub broadcast in job %d.', job.id)

  const payload = job.data as ActivitypubHttpBroadcastPayload

  const body = await computeBody(payload)
  const httpSignatureOptions = await buildSignedRequestOptions(payload)

  const options = {
    method: 'POST',
    uri: '',
    json: body,
    httpSignature: httpSignatureOptions
  }

  const badUrls: string[] = []
  const goodUrls: string[] = []

  for (const uri of payload.uris) {
    options.uri = uri

    try {
      await doRequest(options)
      goodUrls.push(uri)
    } catch (err) {
      badUrls.push(uri)
    }
  }

  return ActorFollowModel.updateActorFollowsScore(goodUrls, badUrls, undefined)
}

// ---------------------------------------------------------------------------

export {
  processActivityPubHttpBroadcast
}
