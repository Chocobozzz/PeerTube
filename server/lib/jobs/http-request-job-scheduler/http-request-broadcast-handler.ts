import * as Bluebird from 'bluebird'

import { database as db } from '../../../initializers/database'
import { logger } from '../../../helpers'

async function process (data: { videoUUID: string }, jobId: number) {

}

function onError (err: Error, jobId: number) {
  logger.error('Error when optimized video file in job %d.', jobId, err)
  return Promise.resolve()
}

async function onSuccess (jobId: number) {

}

// ---------------------------------------------------------------------------

export {
  process,
  onError,
  onSuccess
}
