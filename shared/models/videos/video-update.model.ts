import { VideoPrivacy } from './video-privacy.enum'
import { VideoScheduleUpdate } from './video-schedule-update.model'

export interface VideoUpdate {
  name?: string
  articleid?: number
  category?: number
  licence?: number
  language?: string
  description?: string
  support?: string
  privacy?: VideoPrivacy
  tags?: string[]
  autors?: string[]
  commentsEnabled?: boolean
  nsfw?: boolean
  waitTranscoding?: boolean
  channelId?: number
  thumbnailfile?: Blob
  previewfile?: Blob
  scheduleUpdate?: VideoScheduleUpdate
}
