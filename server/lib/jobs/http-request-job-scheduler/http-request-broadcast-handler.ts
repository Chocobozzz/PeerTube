import { logger } from '../../../helpers'
import { doRequest } from '../../../helpers/requests'
import { HTTPRequestPayload } from './http-request-job-scheduler'

async function process (payload: HTTPRequestPayload, jobId: number) {
  logger.info('Processing broadcast in job %d.', jobId)

  const options = {
    uri: '',
    json: payload.body
  }

  for (const uri of payload.uris) {
    options.uri = uri
    await doRequest(options)
  }
}

function onError (err: Error, jobId: number) {
  logger.error('Error when broadcasting request in job %d.', jobId, err)
  return Promise.resolve()
}

async function onSuccess (jobId: number) {
  logger.info('Job %d is a success.', jobId)
}

// ---------------------------------------------------------------------------

export {
  process,
  onError,
  onSuccess
}
