import { createLogger } from '../../helpers/logger.js'
import { publishToRedis, subscribeToRedis } from './redis-client.js'

const logger = createLogger('redis')

const MODEL_CACHE_INVALIDATION_CHANNEL = 'model-cache-invalidation'

export type ModelCacheInvalidationPayload =
  // A model was updated or deleted
  | { type: 'delete-key', deleteKey: string, modelId: number }
  // Every entry of a cache type must go (instance actor images changed...)
  | { type: 'cache-type', cacheType: string }

export function publishModelCacheInvalidation (payload: ModelCacheInvalidationPayload) {
  return publishToRedis(MODEL_CACHE_INVALIDATION_CHANNEL, JSON.stringify(payload))
}

export function subscribeToModelCacheInvalidation (handler: (payload: ModelCacheInvalidationPayload) => void) {
  return subscribeToRedis(MODEL_CACHE_INVALIDATION_CHANNEL, message => {
    try {
      handler(JSON.parse(message))
    } catch (err) {
      logger.warn('Cannot parse model cache invalidation message.', { err })
    }
  })
}
