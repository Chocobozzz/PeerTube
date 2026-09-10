import { SHARED_CONFIG_REDIS_CHANNEL, SHARED_CONFIG_REDIS_KEY } from '../../initializers/config/shared-config.js'
import { getValue, publishToRedis, setValue, subscribeToRedis } from './redis-client.js'

/**
 * The primary publishes its whole effective configuration here so the other processes run with the same one
 */

export function getSharedConfig () {
  return getValue(SHARED_CONFIG_REDIS_KEY)
}

export function setSharedConfig (value: string) {
  return setValue(SHARED_CONFIG_REDIS_KEY, value)
}

export function publishConfigChanged () {
  return publishToRedis(SHARED_CONFIG_REDIS_CHANNEL, Date.now().toString())
}

export function subscribeToConfigChanges (handler: () => void) {
  return subscribeToRedis(SHARED_CONFIG_REDIS_CHANNEL, () => handler())
}
