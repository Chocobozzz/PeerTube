import { logger } from '../../../helpers/logger'
import { doRequest } from '../../../helpers/requests'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { ActivityPubHttpPayload, buildSignedRequestOptions, computeBody, maybeRetryRequestLater } from './activitypub-http-job-scheduler'

async function process (payload: ActivityPubHttpPayload, jobId: number) {
  logger.info('Processing ActivityPub broadcast in job %d.', jobId)

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
      const isRetryingLater = await maybeRetryRequestLater(err, payload, uri)
      if (isRetryingLater === false) badUrls.push(uri)
    }
  }

  return ActorFollowModel.updateActorFollowsScoreAndRemoveBadOnes(goodUrls, badUrls, undefined)
}

function onError (err: Error, jobId: number) {
  logger.error('Error when broadcasting ActivityPub request in job %d.', jobId, err)
  return Promise.resolve()
}

function onSuccess (jobId: number) {
  logger.info('Job %d is a success.', jobId)
  return Promise.resolve()
}

// ---------------------------------------------------------------------------

export {
  process,
  onError,
  onSuccess
}
