import { PluginType } from './plugin.type'

export interface PeertubePluginIndexList {
  start: number
  count: number
  sort: string
  pluginType?: PluginType
  currentPeerTubeEngine?: string
  search?: string
}
