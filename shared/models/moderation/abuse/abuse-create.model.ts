import { AbusePredefinedReasonsString } from './abuse-reason.model'

export interface AbuseCreate {
  reason: string

  predefinedReasons?: AbusePredefinedReasonsString[]

  account?: {
    id: number
  }

  video?: {
    id: number
    startAt?: number
    endAt?: number
  }

  comment?: {
    id: number
  }
}

// FIXME: deprecated in 2.3. Remove it
export interface VideoAbuseCreate {
  reason: string
  predefinedReasons?: AbusePredefinedReasonsString[]
  startAt?: number
  endAt?: number
}
