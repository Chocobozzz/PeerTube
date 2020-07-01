import { AbusePredefinedReasonsString } from './abuse-reason.model'

export interface AbuseCreate {
  accountId: number

  reason: string
  predefinedReasons?: AbusePredefinedReasonsString[]

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
