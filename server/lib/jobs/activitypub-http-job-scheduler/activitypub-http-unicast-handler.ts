import { doRequest, logger } from '../../../helpers'
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
  } catch (err) {
    await maybeRetryRequestLater(err, payload, uri)
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
