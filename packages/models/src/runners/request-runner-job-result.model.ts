import { RunnerJobPayload } from './runner-job-payload.model.js'
import { RunnerJobType } from './runner-job-type.type.js'

export interface RequestRunnerJobResult <P extends RunnerJobPayload = RunnerJobPayload> {
  availableJobs: {
    uuid: string
    type: RunnerJobType
    payload: P
  }[]
}
