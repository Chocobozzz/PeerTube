export interface FollowersExportJSON {
  followers: {
    handle: string
    createdAt: string
    targetHandle: string

    archiveFiles?: never
  }[]
}
