export interface FollowingExportJSON {
  following: {
    handle: string
    targetHandle: string
    createdAt: string

    archiveFiles?: never
  }[]
}
