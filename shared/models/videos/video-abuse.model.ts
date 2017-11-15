export interface VideoAbuse {
  id: number
  reason: string
  reporterUsername: string
  reporterServerHost: string
  videoId: number
  videoUUID: string
  videoName: string
  createdAt: Date
}
