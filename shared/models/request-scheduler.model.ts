export type RequestEndpoint = 'videos'

export type RequestVideoQaduType = 'likes' | 'dislikes' | 'views'

export type RequestVideoEventType = 'likes' | 'dislikes' | 'views'

export type RequestSchedulerAttributes = {
  totalRequests: number
  requestsLimitPods: number
  requestsLimitPerPod: number
  remainingMilliSeconds: number
  milliSecondsInterval: number
}

export interface RequestScheduler {
  requestScheduler: RequestSchedulerAttributes
  requestVideoQaduScheduler: RequestSchedulerAttributes
  requestVideoEventScheduler: RequestSchedulerAttributes
}
