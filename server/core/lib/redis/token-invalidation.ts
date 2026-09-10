import { createLogger } from '../../helpers/logger.js'
import { publishToRedis, subscribeToRedis } from './redis-client.js'

const logger = createLogger('redis')

const TOKEN_INVALIDATION_CHANNEL = 'token-invalidation'

export type TokenInvalidationPayload = {
  token?: string
  userId?: number
  tokenException?: string
}

export function publishTokenInvalidation (payload: TokenInvalidationPayload) {
  return publishToRedis(TOKEN_INVALIDATION_CHANNEL, JSON.stringify(payload))
}

export function subscribeToTokenInvalidation (handler: (payload: TokenInvalidationPayload) => void) {
  return subscribeToRedis(TOKEN_INVALIDATION_CHANNEL, message => {
    try {
      handler(JSON.parse(message))
    } catch (err) {
      logger.warn('Cannot parse token invalidation message.', { err })
    }
  })
}
