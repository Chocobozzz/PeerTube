import { LiveVideoErrorType } from '@peertube/peertube-models'
import { createLogger } from '../../helpers/logger.js'
import { publishToRedis, subscribeToRedis } from './redis-client.js'

const logger = createLogger('redis')

const LIVE_SESSION_STOP_CHANNEL = 'live-session-stop'

export type LiveSessionStopPayload = {
  videoUUID: string
  error: LiveVideoErrorType | null

  expectedSessionId?: string // Prevent stopping another session of permanent live
  errorOnReplay?: boolean
}

export function publishLiveSessionStop (payload: LiveSessionStopPayload) {
  return publishToRedis(LIVE_SESSION_STOP_CHANNEL, JSON.stringify(payload))
}

export function subscribeToLiveSessionStop (handler: (payload: LiveSessionStopPayload) => void) {
  return subscribeToRedis(LIVE_SESSION_STOP_CHANNEL, message => {
    try {
      handler(JSON.parse(message))
    } catch (err) {
      logger.warn('Cannot parse live session stop message.', { err })
    }
  })
}
