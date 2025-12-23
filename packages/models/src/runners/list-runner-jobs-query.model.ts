import { RunnerJobStateType } from './runner-jobs/runner-job-state.model.js'

export interface ListRunnerJobsQuery {
  start?: number
  count?: number
  sort?: string
  search?: string
  stateOneOf?: RunnerJobStateType[]
}
