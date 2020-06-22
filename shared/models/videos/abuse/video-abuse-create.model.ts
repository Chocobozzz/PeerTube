import { VideoAbusePredefinedReasonsString } from './video-abuse-reason.model'

export interface VideoAbuseCreate {
  reason: string
  predefinedReasons?: VideoAbusePredefinedReasonsString[]
  startAt?: number
  endAt?: number
}
