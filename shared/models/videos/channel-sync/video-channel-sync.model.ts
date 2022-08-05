import { VideoChannelSummary } from '../channel/video-channel.model'
import { VideoConstant } from '../video-constant.model'
import { VideoChannelSyncState } from './video-channel-sync-state.enum'

export interface VideoChannelSync {
  id: number

  externalChannelUrl: string

  createdAt: string
  channel: VideoChannelSummary
  state: VideoConstant<VideoChannelSyncState>
  lastSyncAt: string
}
