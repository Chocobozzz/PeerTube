import { logger } from '../../../helpers/logger'
import { doRequest } from '../../../helpers/requests'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { ActivityPubHttpPayload, buildSignedRequestOptions, computeBody, maybeRetryRequestLater } from './activitypub-http-job-scheduler'

async function process (payload: ActivityPubHttpPayload, jobId: number) {
  logger.info('Processing ActivityPub unicast in job %d.', jobId)

  const body = await computeBody(payload)
  const httpSignatureOptions = await buildSignedRequestOptions(payload)

  const uri = payload.uris[0]
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
    const isRetryingLater = await maybeRetryRequestLater(err, payload, uri)
    if (isRetryingLater === false) {
      ActorFollowModel.updateActorFollowsScoreAndRemoveBadOnes([], [ uri ], undefined)
    }

    throw err
  }
}

function onError (err: Error, jobId: number) {
  logger.error('Error when sending ActivityPub request in job %d.', jobId, err)
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
