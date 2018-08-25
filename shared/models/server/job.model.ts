export type JobState = 'active' | 'completed' | 'failed' | 'waiting' | 'delayed'

export type JobType = 'activitypub-http-unicast' |
  'activitypub-http-broadcast' |
  'activitypub-http-fetcher' |
  'activitypub-follow' |
  'video-file-import' |
  'video-file' |
  'email' |
  'video-import'

export interface Job {
  id: number
  state: JobState
  type: JobType
  data: any,
  error: any,
  createdAt: Date
  finishedOn: Date
  processedOn: Date
}
