import { ActivityFlagReasonObject } from './common-objects.js'

export interface AbuseObject {
  type: 'Flag'

  content: string
  mediaType: 'text/markdown'

  object: string | string[]

  tag?: ActivityFlagReasonObject[]

  startAt?: number
  endAt?: number
}
