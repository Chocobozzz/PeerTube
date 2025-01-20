import { RunnerJobType } from './runner-jobs/runner-job-type.type.js'

export interface RequestRunnerJobBody {
  runnerToken: string
  jobTypes?: RunnerJobType[]
}
