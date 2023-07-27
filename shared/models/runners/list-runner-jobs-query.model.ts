import { RunnerJobState } from './runner-job-state.model'

export interface ListRunnerJobsQuery {
  start?: number
  count?: number
  sort?: string
  search?: string
  stateOneOf?: RunnerJobState[]
}
