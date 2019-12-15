import { VideoPrivacy } from './video-privacy.enum'

export interface VideoScheduleUpdate {
  updateAt: Date | string
  privacy?: VideoPrivacy.PUBLIC | VideoPrivacy.UNLISTED | VideoPrivacy.INTERNAL // Cannot schedule an update to PRIVATE
}
