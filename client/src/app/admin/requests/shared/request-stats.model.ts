export interface RequestStats {
  milliSecondsInterval: number;
	remainingMilliSeconds: number;
  requests: {
    request: any,
    to: any
  }[];
}
