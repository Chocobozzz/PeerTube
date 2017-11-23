import { logger } from '../../../helpers'
import { doRequest } from '../../../helpers/requests'
import { ActivityPubHttpPayload, maybeRetryRequestLater } from './activitypub-http-job-scheduler'
import { database as db } from '../../../initializers/database'
import { buildSignedActivity } from '../../../helpers/activitypub'

async function process (payload: ActivityPubHttpPayload, jobId: number) {
  logger.info('Processing ActivityPub unicast in job %d.', jobId)

  const accountSignature = await db.Account.load(payload.signatureAccountId)
  if (!accountSignature) throw new Error('Unknown signature account id.')

  const signedBody = await buildSignedActivity(accountSignature, payload.body)
  const uri = payload.uris[0]
  const options = {
    method: 'POST',
    uri,
    json: signedBody
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
