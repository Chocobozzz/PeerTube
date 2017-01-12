export interface Request {
  request: any;
  to: any;
}

export class RequestStats {
  maxRequestsInParallel: number;
  milliSecondsInterval: number;
  remainingMilliSeconds: number;
  totalRequests: number;

  constructor(hash: {
    maxRequestsInParallel: number,
    milliSecondsInterval: number,
    remainingMilliSeconds: number,
    totalRequests: number;
  }) {
    this.maxRequestsInParallel = hash.maxRequestsInParallel;
    this.milliSecondsInterval = hash.milliSecondsInterval;
    this.remainingMilliSeconds = hash.remainingMilliSeconds;
    this.totalRequests = hash.totalRequests;
  }

  get remainingSeconds() {
    return Math.floor(this.remainingMilliSeconds / 1000);
  }

  get secondsInterval() {
    return Math.floor(this.milliSecondsInterval / 1000);
  }

}
