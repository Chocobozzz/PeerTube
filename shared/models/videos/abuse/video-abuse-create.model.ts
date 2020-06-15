export interface VideoAbuseCreate {
  reason: string
  predefinedReasons?: {[key: string]: boolean} // see VideoAbusePredefinedReasonsIn
  startAt?: number
  endAt?: number
}
