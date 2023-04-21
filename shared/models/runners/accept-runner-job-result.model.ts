import { RunnerJobPayload } from './runner-job-payload.model'
import { RunnerJob } from './runner-job.model'

export interface AcceptRunnerJobResult <T extends RunnerJobPayload = RunnerJobPayload> {
  job: RunnerJob<T> & { jobToken: string }
}
