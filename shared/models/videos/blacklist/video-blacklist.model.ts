import { Video } from '../video.model'

export enum VideoBlacklistType {
  MANUAL = 1,
  AUTO_BEFORE_PUBLISHED = 2
}

export interface VideoBlacklist {
  id: number
  createdAt: Date
  updatedAt: Date
  unfederated: boolean
  reason?: string
  type: VideoBlacklistType

  video: Video
}
