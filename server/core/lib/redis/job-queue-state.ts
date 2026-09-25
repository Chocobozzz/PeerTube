import { ProcessRole } from '@peertube/peertube-models'
import { createLogger } from '../../helpers/logger.js'
import { publishToRedis, subscribeToRedis } from './redis-client.js'

const logger = createLogger('redis')

const JOB_QUEUE_STATE_CHANNEL = 'job-queue-state'

export type JobQueueStatePayload = {
  action: 'pause' | 'resume'
  processRoles: ProcessRole[]

  // The sender already applied the change
  senderId: string
}

export function publishJobQueueState (payload: JobQueueStatePayload) {
  return publishToRedis(JOB_QUEUE_STATE_CHANNEL, JSON.stringify(payload))
}

export function subscribeToJobQueueState (handler: (payload: JobQueueStatePayload) => void) {
  return subscribeToRedis(JOB_QUEUE_STATE_CHANNEL, message => {
    try {
      handler(JSON.parse(message))
    } catch (err) {
      logger.warn('Cannot parse job queue state message.', { err })
    }
  })
}
