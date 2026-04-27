import { VideoChannelSummary } from '../channel/video-channel.model.js'
import { ConstantLabel } from '../../common/constant-label.model.js'
import { StreamSyncStateType } from '../../common/stream-sync-state.enum.js'

export interface VideoChannelSync {
  id: number

  externalChannelUrl: string

  createdAt: string
  channel: VideoChannelSummary
  state: ConstantLabel<StreamSyncStateType>
  lastSyncAt: string
}
