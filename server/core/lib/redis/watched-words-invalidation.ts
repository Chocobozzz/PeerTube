import { createLogger } from '../../helpers/logger.js'
import { publishToRedis, subscribeToRedis } from './redis-client.js'

const logger = createLogger('redis')

const WATCHED_WORDS_INVALIDATION_CHANNEL = 'watched-words-invalidation'

export type WatchedWordsInvalidationPayload = {
  accountId: number
}

export function publishWatchedWordsInvalidation (payload: WatchedWordsInvalidationPayload) {
  return publishToRedis(WATCHED_WORDS_INVALIDATION_CHANNEL, JSON.stringify(payload))
}

export function subscribeToWatchedWordsInvalidation (handler: (payload: WatchedWordsInvalidationPayload) => void) {
  return subscribeToRedis(WATCHED_WORDS_INVALIDATION_CHANNEL, message => {
    try {
      handler(JSON.parse(message))
    } catch (err) {
      logger.warn('Cannot parse watched words invalidation message.', { err })
    }
  })
}
