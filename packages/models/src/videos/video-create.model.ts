import { VideoCommentPolicyType } from './comment/video-comment-policy.enum.js'
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

  // TODO: remove, deprecated in 6.2
  commentsEnabled?: boolean
  commentsPolicy?: VideoCommentPolicyType

  downloadEnabled?: boolean
  privacy: VideoPrivacyType
  scheduleUpdate?: VideoScheduleUpdate
  originallyPublishedAt?: Date | string
  videoPasswords?: string[]

  thumbnailfile?: Blob | string
  previewfile?: Blob | string
}
