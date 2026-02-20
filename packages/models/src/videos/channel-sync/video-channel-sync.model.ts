import { VideoChannelSummary } from '../channel/video-channel.model.js'
import { ConstantLabel } from '../../common/constant-label.model.js'
import { VideoChannelSyncStateType } from './video-channel-sync-state.enum.js'

export interface VideoChannelSync {
  id: number

  externalChannelUrl: string

  createdAt: string
  channel: VideoChannelSummary
  state: ConstantLabel<VideoChannelSyncStateType>
  lastSyncAt: string
}
