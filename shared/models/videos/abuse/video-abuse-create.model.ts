import { VideoAbusePredefinedReasonsIn } from './video-abuse-reason.model'

export interface VideoAbuseCreate {
  reason: string
  predefinedReasons?: VideoAbusePredefinedReasonsIn[]
  startAt?: number
  endAt?: number
}
