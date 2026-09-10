import { createLogger } from '../../helpers/logger.js'
import { publishToRedis, subscribeToRedis } from './redis-client.js'

const logger = createLogger('redis')

const PLUGIN_CHANGES_CHANNEL = 'plugin-changes'

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
