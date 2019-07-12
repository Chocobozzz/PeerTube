export interface PeerTubePlugin {
  name: string
  type: number
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
