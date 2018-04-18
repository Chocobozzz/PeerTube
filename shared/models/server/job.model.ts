export type JobState = 'active' | 'complete' | 'failed' | 'inactive' | 'delayed'

export type JobType = 'activitypub-http-unicast' |
  'activitypub-http-broadcast' |
  'activitypub-http-fetcher' |
  'activitypub-follow' |
  'video-file' |
  'email'

export interface Job {
  id: number
  state: JobState
  type: JobType
  data: any,
  error: any,
  createdAt: Date
  updatedAt: Date
}
