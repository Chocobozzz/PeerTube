import { PluginType_Type } from '../plugin.type.js'

export interface PeertubePluginIndexList {
  start: number
  count: number
  sort: string
  pluginType?: PluginType_Type
  currentPeerTubeEngine?: string
  search?: string
}
