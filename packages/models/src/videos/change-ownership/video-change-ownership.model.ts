import { Account } from '../../actors/index.js'
import { Video } from '../video.model.js'

export interface VideoChangeOwnership {
  id: number
  status: VideoChangeOwnershipStatusType
  initiatorAccount: Account
  nextOwnerAccount: Account
  video: Video
  createdAt: Date
}

export const VideoChangeOwnershipStatus = {
  WAITING: 'WAITING',
  ACCEPTED: 'ACCEPTED',
  REFUSED: 'REFUSED'
} as const

export type VideoChangeOwnershipStatusType = typeof VideoChangeOwnershipStatus[keyof typeof VideoChangeOwnershipStatus]
