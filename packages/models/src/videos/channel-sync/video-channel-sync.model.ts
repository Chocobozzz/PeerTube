import { VideoChannelSummary } from '../channel/video-channel.model.js'
import { VideoConstant } from '../video-constant.model.js'
import { VideoChannelSyncStateType } from './video-channel-sync-state.enum.js'

export interface VideoChannelSync {
  id: number

  externalChannelUrl: string

  createdAt: string
  channel: VideoChannelSummary
  state: VideoConstant<VideoChannelSyncStateType>
  lastSyncAt: string
}
