import { ActivityFlagReasonObject } from './common-objects'

export interface AbuseObject {
  type: 'Flag'
  content: string
  object: string | string[]

  tag?: ActivityFlagReasonObject[]

  startAt?: number
  endAt?: number
}
