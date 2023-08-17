export interface AbortRunnerJobBody {
  runnerToken: string
  jobToken: string

  reason: string
}
