import { VideoPrivacy } from './video-privacy.enum'

export interface VideoScheduleUpdate {
  updateAt: Date | string
  privacy?: VideoPrivacy.PUBLIC | VideoPrivacy.UNLISTED // Cannot schedule an update to PRIVATE
}
