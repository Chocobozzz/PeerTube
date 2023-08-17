export interface PeertubePluginLatestVersionRequest {
  currentPeerTubeEngine?: string

  npmNames: string[]
}

export type PeertubePluginLatestVersionResponse = {
  npmName: string
  latestVersion: string | null
}[]
