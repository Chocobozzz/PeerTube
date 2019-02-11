import { VideoPrivacy } from './video-privacy.enum'
import { VideoScheduleUpdate } from './video-schedule-update.model'

export interface VideoCreate {
  category?: number
  licence?: number
  language?: string
  description?: string
  support?: string
  channelId: number
  nsfw?: boolean
  waitTranscoding?: boolean
  name: string
  tags?: string[]
  commentsEnabled?: boolean
  downloadEnabled?: boolean
  privacy: VideoPrivacy
  scheduleUpdate?: VideoScheduleUpdate
  originallyPublishedAt: Date | string
}
