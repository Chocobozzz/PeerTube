export interface PeerTubePlugin {
  name: string
  type: number
  version: string
  enabled: boolean
  uninstalled: boolean
  peertubeEngine: string
  description: string
  settings: any
  createdAt: Date
  updatedAt: Date
}
