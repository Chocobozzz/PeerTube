export type JobState = 'active' | 'completed' | 'failed' | 'waiting' | 'delayed'

export type JobType =
  | 'activitypub-http-unicast'
  | 'activitypub-http-broadcast'
  | 'activitypub-http-fetcher'
  | 'activitypub-follow'
  | 'video-file-import'
  | 'video-transcoding'
  | 'email'
  | 'video-import'
  | 'videos-views'
  | 'activitypub-refresher'
  | 'video-redundancy'

export interface Job {
  id: number
  state: JobState
  type: JobType
  data: any
  error: any
  createdAt: Date | string
  finishedOn: Date | string
  processedOn: Date | string
}
