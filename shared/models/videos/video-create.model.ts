import { VideoPrivacy } from './video-privacy.enum'

export interface VideoCreate {
  category?: number
  licence?: number
  language?: string
  description?: string
  support?: string
  channelId: number
  nsfw: boolean
  name: string
  tags?: string[]
  commentsEnabled?: boolean
  privacy: VideoPrivacy
}
