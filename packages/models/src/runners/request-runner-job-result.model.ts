import { RunnerJobPayload } from './runner-jobs/runner-job-payload.model.js'
import { RunnerJobType } from './runner-jobs/runner-job-type.type.js'

export interface RequestRunnerJobResult <P extends RunnerJobPayload = RunnerJobPayload> {
  availableJobs: {
    uuid: string
    type: RunnerJobType
    payload: P
  }[]
}
