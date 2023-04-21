import { RunnerJobPayload } from './runner-job-payload.model'
import { RunnerJobType } from './runner-job-type.type'

export interface RequestRunnerJobResult <P extends RunnerJobPayload = RunnerJobPayload> {
  availableJobs: {
    uuid: string
    type: RunnerJobType
    payload: P
  }[]
}
