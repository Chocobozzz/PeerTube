export type JobState = 'pending' | 'processing' | 'error' | 'success'
export type JobCategory = 'transcoding' | 'activitypub-http'

export interface Job {
  id: number
  state: JobState
  category: JobCategory
  handlerName: string
  handlerInputData: any
  createdAt: Date
  updatedAt: Date
}
