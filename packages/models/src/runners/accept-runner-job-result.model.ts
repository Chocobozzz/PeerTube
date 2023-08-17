import { RunnerJobPayload } from './runner-job-payload.model.js'
import { RunnerJob } from './runner-job.model.js'

export interface AcceptRunnerJobResult <T extends RunnerJobPayload = RunnerJobPayload> {
  job: RunnerJob<T> & { jobToken: string }
}
