import { VideoPrivacy } from './video-privacy.enum'

export interface VideoUpdate {
  name?: string
  category?: number
  licence?: number
  language?: number
  description?: string
  support?: string
  privacy?: VideoPrivacy
  tags?: string[]
  commentsEnabled?: boolean
  nsfw?: boolean
}
