export interface Request {
  request: any;
  to: any;
}

export class RequestStats {
  maxRequestsInParallel: number;
  milliSecondsInterval: number;
  remainingMilliSeconds: number;
  requests: Request[];

  constructor(hash: {
    maxRequestsInParallel: number,
    milliSecondsInterval: number,
    remainingMilliSeconds: number,
    requests: Request[];
  }) {
    this.maxRequestsInParallel = hash.maxRequestsInParallel;
    this.milliSecondsInterval = hash.milliSecondsInterval;
    this.remainingMilliSeconds = hash.remainingMilliSeconds;
    this.requests = hash.requests;
  }

  get remainingSeconds() {
    return Math.floor(this.remainingMilliSeconds / 1000);
  }

  get secondsInterval() {
    return Math.floor(this.milliSecondsInterval / 1000);
  }

}
