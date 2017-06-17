import { RequestSchedulerAttributes as FormatedRequestSchedulerAttributes } from '../../../../../../shared'

export interface Request {
  request: any
  to: any
}

export class RequestSchedulerStatsAttributes implements FormatedRequestSchedulerAttributes {
  requestsLimitPods: number
  requestsLimitPerPod: number
  milliSecondsInterval: number
  remainingMilliSeconds: number
  totalRequests: number

  constructor (hash: {
    requestsLimitPods: number,
    requestsLimitPerPod: number,
    milliSecondsInterval: number,
    remainingMilliSeconds: number,
    totalRequests: number
  }) {
    this.requestsLimitPods = hash.requestsLimitPods
    this.requestsLimitPerPod = hash.requestsLimitPerPod
    this.milliSecondsInterval = hash.milliSecondsInterval
    this.remainingMilliSeconds = hash.remainingMilliSeconds
    this.totalRequests = hash.totalRequests
  }

  get remainingSeconds () {
    return Math.floor(this.remainingMilliSeconds / 1000)
  }

  get secondsInterva () {
    return Math.floor(this.milliSecondsInterval / 1000)
  }

}
