import { VideoCommentPolicyType } from './comment/video-comment-policy.enum.js'
import { VideoPrivacyType } from './video-privacy.enum.js'
import { VideoScheduleUpdate } from './video-schedule-update.model.js'

export interface VideoCreateUpdateCommon {
  name?: string
  category?: number
  licence?: number
  language?: string
  description?: string
  support?: string
  privacy?: VideoPrivacyType
  tags?: string[]

  commentsPolicy?: VideoCommentPolicyType

  downloadEnabled?: boolean

  nsfw?: boolean
  nsfwSummary?: string
  nsfwFlags?: number

  waitTranscoding?: boolean
  channelId?: number
  thumbnailfile?: Blob
  // TODO: remove in v10, deprecated in 8.1
  previewfile?: Blob
  scheduleUpdate?: VideoScheduleUpdate
  originallyPublishedAt?: Date | string
  videoPasswords?: string[]
}
