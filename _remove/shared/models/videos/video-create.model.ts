import { VideoPrivacy } from './video-privacy.enum'
import { VideoScheduleUpdate } from './video-schedule-update.model'

export interface VideoCreate {
  name: string
  channelId: number

  category?: number
  licence?: number
  language?: string
  description?: string
  support?: string
  nsfw?: boolean
  waitTranscoding?: boolean
  tags?: string[]
  commentsEnabled?: boolean
  downloadEnabled?: boolean
  privacy: VideoPrivacy
  scheduleUpdate?: VideoScheduleUpdate
  originallyPublishedAt?: Date | string

  thumbnailfile?: Blob | string
  previewfile?: Blob | string
}
