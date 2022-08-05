import { Video } from '../video.model'

export const enum VideoBlacklistType {
  MANUAL = 1,
  AUTO_BEFORE_PUBLISHED = 2
}

export interface VideoBlacklist {
  id: number
  unfederated: boolean
  reason?: string
  type: VideoBlacklistType

  video: Video

  createdAt: Date
  updatedAt: Date
}
