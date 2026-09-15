import { createLogger } from '../../helpers/logger.js'
import { getValue, publishToRedis, removeValue, setValue, subscribeToRedis } from './redis-client.js'

const logger = createLogger('redis')

const PLUGIN_CHANGES_CHANNEL = 'plugin-changes'
const PRIMARY_REGISTERED_PLUGINS_KEY = 'primary-registered-plugins'

export type PluginChangePayload =
  // The primary installed, updated or uninstalled a plugin/theme
  | { type: 'installed-plugins-changed' }
  // An admin changed the settings of a plugin (`onSettingsChange` callbacks must run on every process)
  | { type: 'plugin-settings-changed', npmName: string }

export function publishPluginChange (payload: PluginChangePayload) {
  return publishToRedis(PLUGIN_CHANGES_CHANNEL, JSON.stringify(payload))
}

export function subscribeToPluginChanges (handler: (payload: PluginChangePayload) => void) {
  return subscribeToRedis(PLUGIN_CHANGES_CHANNEL, message => {
    try {
      handler(JSON.parse(message))
    } catch (err) {
      logger.warn('Cannot parse plugin change message.', { err })
    }
  })
}

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
