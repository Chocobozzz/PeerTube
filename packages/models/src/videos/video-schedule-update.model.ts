import { VideoPrivacy } from './video-privacy.enum.js'

export interface VideoScheduleUpdate {
  updateAt: Date | string
  // Cannot schedule an update to PRIVATE
  privacy?: typeof VideoPrivacy.PUBLIC | typeof VideoPrivacy.UNLISTED | typeof VideoPrivacy.INTERNAL
}
