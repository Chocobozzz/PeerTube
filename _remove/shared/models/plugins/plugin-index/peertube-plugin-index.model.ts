export interface PeerTubePluginIndex {
  npmName: string
  description: string
  homepage: string
  createdAt: Date
  updatedAt: Date

  popularity: number

  latestVersion: string

  official: boolean

  name?: string
  installed?: boolean
}
