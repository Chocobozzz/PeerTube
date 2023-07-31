import { PluginType_Type } from '../../plugin.type.js'

export interface PeerTubePlugin {
  name: string
  type: PluginType_Type
  latestVersion: string
  version: string
  enabled: boolean
  uninstalled: boolean
  peertubeEngine: string
  description: string
  homepage: string
  settings: { [ name: string ]: string }
  createdAt: Date
  updatedAt: Date
}
