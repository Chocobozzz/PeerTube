import { Video } from '../video.model'
import { VideoConstant } from '../video-constant.model'
import { VideoChannelsSyncState } from './video-channels-sync-state.enum'

export interface VideoChannelsSync {
  id: number

  externalChannelUrl: string

  createdAt: string
  updatedAt: string
  state: VideoConstant<VideoChannelsSyncState>
}
