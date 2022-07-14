import { VideoChannelSummary } from '../channel/video-channel.model'
import { VideoConstant } from '../video-constant.model'
import { VideoChannelSyncState } from './video-channel-sync-state.enum'

export interface VideoChannelSync {
  id: number

  externalChannelUrl: string

  createdAt: string
  updatedAt: string
  channel?: VideoChannelSummary
  channelId: number
  state: VideoConstant<VideoChannelSyncState>
}
