import { SHARED_CONFIG_REDIS_KEY } from '../../initializers/config/shared-config.js'
import { getValue, setValue } from './redis-client.js'

/**
 * The primary publishes its whole effective configuration here so the other processes run with the same one
 */

export function getSharedConfig () {
  return getValue(SHARED_CONFIG_REDIS_KEY)
}

export function setSharedConfig (value: string) {
  return setValue(SHARED_CONFIG_REDIS_KEY, value)
}
