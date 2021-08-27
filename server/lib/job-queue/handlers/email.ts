import { Job } from 'bull'
import { EmailPayload } from '@shared/models'
import { logger } from '../../../helpers/logger'
import { Emailer } from '../../emailer'

async function processEmail (job: Job) {
  const payload = job.data as EmailPayload
  logger.info('Processing email in job %d.', job.id)

  return Emailer.Instance.sendMail(payload)
}

// ---------------------------------------------------------------------------

export {
  processEmail
}
