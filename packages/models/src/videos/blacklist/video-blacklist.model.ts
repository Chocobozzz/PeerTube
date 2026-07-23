import { Video } from '../video.model.js'

export const VideoBlacklistType = {
  MANUAL: 1,
  AUTO_BY_INSTANCE_POLICY: 2,
  AUTO_BY_AUTO_TAG_POLICY: 3
} as const

export type VideoBlacklistType_Type = typeof VideoBlacklistType[keyof typeof VideoBlacklistType]

export interface VideoBlacklist {
  id: number
  unfederated: boolean
  reason?: string
  internalNote?: string
  type: VideoBlacklistType_Type

  video: Video

  createdAt: Date
  updatedAt: Date
}
