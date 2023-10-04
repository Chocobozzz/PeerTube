import { PluginModel } from '@server/models/server/plugin.js'

export type MPlugin = PluginModel

// ############################################################################

// Format for API or AP object

export type MPluginFormattable =
  Pick<MPlugin, 'name' | 'type' | 'version' | 'latestVersion' | 'enabled' | 'uninstalled'
  | 'peertubeEngine' | 'description' | 'homepage' | 'settings' | 'createdAt' | 'updatedAt'>
