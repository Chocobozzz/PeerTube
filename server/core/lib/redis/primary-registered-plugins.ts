import { createLogger } from '../../helpers/logger.js'
import { getValue, removeValue, setValue } from './redis-client.js'

const logger = createLogger('redis')

const PRIMARY_REGISTERED_PLUGINS_KEY = 'primary-registered-plugins'

// The plugins and themes the primary process registered, so a secondary can detect it failed to register one of them
export function setPrimaryRegisteredPlugins (npmNames: string[]) {
  return setValue(PRIMARY_REGISTERED_PLUGINS_KEY, JSON.stringify(npmNames))
}

export async function getPrimaryRegisteredPlugins (): Promise<string[]> {
  const value = await getValue(PRIMARY_REGISTERED_PLUGINS_KEY)
  if (!value) return undefined

  try {
    return JSON.parse(value)
  } catch (err) {
    logger.warn('Cannot parse the plugins registered by the primary process.', { err })
    return undefined
  }
}

export function deletePrimaryRegisteredPlugins () {
  return removeValue(PRIMARY_REGISTERED_PLUGINS_KEY)
}
