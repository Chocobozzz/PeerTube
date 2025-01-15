import { RunnerJobPayload } from './runner-jobs/runner-job-payload.model.js'
import { RunnerJob } from './runner-jobs/runner-job.model.js'

export interface AcceptRunnerJobResult <T extends RunnerJobPayload = RunnerJobPayload> {
  job: RunnerJob<T> & { jobToken: string }
}
