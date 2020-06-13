import { ActivityFlagReasonObject } from './common-objects'

export interface VideoAbuseObject {
  type: 'Flag'
  content: string
  object: string | string[]
  tag?: ActivityFlagReasonObject[]
  startTime?: string
  endTime?: string
}
