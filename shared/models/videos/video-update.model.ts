import { VideoPrivacy } from './video-privacy.enum'

export interface VideoUpdate {
  name?: string
  category?: number
  licence?: number
  language?: string
  description?: string
  support?: string
  privacy?: VideoPrivacy
  tags?: string[]
  commentsEnabled?: boolean
  nsfw?: boolean
  channelId?: number
  thumbnailfile?: Blob
  previewfile?: Blob
}
