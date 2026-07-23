import { VideoPrivacyType } from '../../videos/video-privacy.enum.js'

export interface VideoChannelSyncCreate {
  externalChannelUrl: string
  videoChannelId: number

  videoPrivacy?: VideoPrivacyType
}
