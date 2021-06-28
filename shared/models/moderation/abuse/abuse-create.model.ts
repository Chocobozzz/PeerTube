import { AbusePredefinedReasonsString } from './abuse-reason.model'

export interface AbuseCreate {
  reason: string

  predefinedReasons?: AbusePredefinedReasonsString[]

  account?: {
    id: number
  }

  video?: {
    id: number | string
    startAt?: number
    endAt?: number
  }

  comment?: {
    id: number
  }
}
