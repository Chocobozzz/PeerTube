export interface Request {
  request: any;
  to: any;
}

export class RequestStats {
  milliSecondsInterval: number;
	remainingMilliSeconds: number;
  requests: Request[];

  constructor(hash: {
    milliSecondsInterval: number,
    remainingMilliSeconds: number,
    requests: Request[];
  }) {
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
