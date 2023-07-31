import { Video } from '../video.model.js'

export const VideoBlacklistType = {
  MANUAL: 1,
  AUTO_BEFORE_PUBLISHED: 2
} as const

export type VideoBlacklistType_Type = typeof VideoBlacklistType[keyof typeof VideoBlacklistType]

export interface VideoBlacklist {
  id: number
  unfederated: boolean
  reason?: string
  type: VideoBlacklistType_Type

  video: Video

  createdAt: Date
  updatedAt: Date
}
