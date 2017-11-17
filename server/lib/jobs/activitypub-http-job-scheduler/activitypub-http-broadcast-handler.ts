import { logger } from '../../../helpers'
import { buildSignedActivity } from '../../../helpers/activitypub'
import { doRequest } from '../../../helpers/requests'
import { database as db } from '../../../initializers'
import { ActivityPubHttpPayload } from './activitypub-http-job-scheduler'

async function process (payload: ActivityPubHttpPayload, jobId: number) {
  logger.info('Processing ActivityPub broadcast in job %d.', jobId)

  const accountSignature = await db.Account.load(payload.signatureAccountId)
  if (!accountSignature) throw new Error('Unknown signature account id.')

  const signedBody = await buildSignedActivity(accountSignature, payload.body)

  const options = {
    method: 'POST',
    uri: '',
    json: signedBody
  }

  for (const uri of payload.uris) {
    options.uri = uri
    await doRequest(options)
  }
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
