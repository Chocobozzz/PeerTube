import { ConstantLabel } from '../../common/constant-label.model.js'
import { StreamSyncStateType } from '../../common/stream-sync-state.enum.js'
import { VideoPrivacyType } from '../../videos/video-privacy.enum.js'
import { VideoChannelSummary } from '../channel/video-channel.model.js'

export interface VideoChannelSync {
  id: number

  externalChannelUrl: string

  createdAt: string
  channel: VideoChannelSummary
  state: ConstantLabel<StreamSyncStateType>
  lastSyncAt: string

  videoPrivacy: VideoPrivacyType | null
}
