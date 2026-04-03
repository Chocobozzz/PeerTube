import { Account } from '../../actors/index.js'
import { ConstantLabel } from '../../common/constant-label.model.js'
import { VideoChannelSummary } from '../channel/video-channel.model.js'
import { VideoSummary } from '../video.model.js'

export interface ChangeOwnership {
  id: number

  state: ConstantLabel<ChangeOwnershipStateType>

  // Deprecated in 8.2, remove in v9
  // Use `state` instead
  status: 'WAITING' | 'ACCEPTED' | 'REFUSED'

  initiatorAccount: Account
  nextOwnerAccount: Account

  video: VideoSummary
  videoChannel: VideoChannelSummary

  createdAt: Date
}

export const ChangeOwnershipState = {
  PENDING: 1,
  REJECTED: 2,
  ACCEPTED: 3
} as const

export type ChangeOwnershipStateType = typeof ChangeOwnershipState[keyof typeof ChangeOwnershipState]
