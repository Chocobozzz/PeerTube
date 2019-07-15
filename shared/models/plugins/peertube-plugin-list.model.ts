import { PluginType } from './plugin.type'

export interface PeertubePluginList {
  start: number
  count: number
  sort: string
  pluginType?: PluginType
  currentPeerTubeEngine?: string
  search?: string
}
