import { VideoConstant } from '../videos'
import { RunnerJobPayload } from './runner-job-payload.model'
import { RunnerJobPrivatePayload } from './runner-job-private-payload.model'
import { RunnerJobState } from './runner-job-state.model'
import { RunnerJobType } from './runner-job-type.type'

export interface RunnerJob <T extends RunnerJobPayload = RunnerJobPayload> {
  uuid: string

  type: RunnerJobType

  state: VideoConstant<RunnerJobState>

  payload: T

  failures: number
  error: string | null

  progress: number
  priority: number

  startedAt: Date | string
  createdAt: Date | string
  updatedAt: Date | string
  finishedAt: Date | string

  parent?: {
    type: RunnerJobType
    state: VideoConstant<RunnerJobState>
    uuid: string
  }

  // If associated to a runner
  runner?: {
    id: number
    name: string

    description: string
  }
}

// eslint-disable-next-line max-len
export interface RunnerJobAdmin <T extends RunnerJobPayload = RunnerJobPayload, U extends RunnerJobPrivatePayload = RunnerJobPrivatePayload> extends RunnerJob<T> {
  privatePayload: U
}
