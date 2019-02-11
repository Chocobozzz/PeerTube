import { VideoPrivacy } from './video-privacy.enum'
import { VideoScheduleUpdate } from './video-schedule-update.model'

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
  downloadEnabled?: boolean
  nsfw?: boolean
  waitTranscoding?: boolean
  channelId?: number
  thumbnailfile?: Blob
  previewfile?: Blob
  scheduleUpdate?: VideoScheduleUpdate
  originallyPublishedAt?: Date | string
}
