import { VideoPrivacyType } from './video-privacy.enum.js'
import { VideoScheduleUpdate } from './video-schedule-update.model.js'

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
  privacy: VideoPrivacyType
  scheduleUpdate?: VideoScheduleUpdate
  originallyPublishedAt?: Date | string
  videoPasswords?: string[]

  thumbnailfile?: Blob | string
  previewfile?: Blob | string
}
