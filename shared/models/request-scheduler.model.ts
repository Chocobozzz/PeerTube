export type RequestEndpoint = 'videos'

export type RequestVideoQaduType = 'likes' | 'dislikes' | 'views'

export type RequestVideoEventType = 'likes' | 'dislikes' | 'views'

export type RequestSchedulerStatsAttributes = {
  totalRequests: number
  requestsLimitPods: number
  requestsLimitPerPod: number
  remainingMilliSeconds: number
  milliSecondsInterval: number
}

export interface RequestSchedulerStats {
  requestScheduler: RequestSchedulerStatsAttributes
  requestVideoQaduScheduler: RequestSchedulerStatsAttributes
  requestVideoEventScheduler: RequestSchedulerStatsAttributes
}
