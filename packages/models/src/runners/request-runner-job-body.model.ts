import { RunnerJobType } from './runner-job-type.type.js'

export interface RequestRunnerJobBody {
  runnerToken: string
  jobTypes?: RunnerJobType[]
}
