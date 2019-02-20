import * as Bull from 'bull'
import { logger } from '../../../helpers/logger'
import { Emailer, SendEmailOptions } from '../../emailer'

export type EmailPayload = SendEmailOptions

async function processEmail (job: Bull.Job) {
  const payload = job.data as EmailPayload
  logger.info('Processing email in job %d.', job.id)

  return Emailer.Instance.sendMail(payload)
}

// ---------------------------------------------------------------------------

export {
  processEmail
}
