export interface PeerTubePlugin {
  name: string
  type: number
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
