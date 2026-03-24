import { RunnerJobStateType } from './runner-jobs/runner-job-state.model.js'
import { RunnerJobType } from './runner-jobs/runner-job-type.type.js'

export interface ListRunnerJobsQuery {
  start?: number
  count?: number
  sort?: string
  search?: string
  stateOneOf?: RunnerJobStateType[]
  typeOneOf?: RunnerJobType[]
}
