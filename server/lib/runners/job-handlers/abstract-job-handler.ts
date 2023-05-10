import { throttle } from 'lodash'
import { retryTransactionWrapper } from '@server/helpers/database-utils'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { RUNNER_JOBS } from '@server/initializers/constants'
import { sequelizeTypescript } from '@server/initializers/database'
import { PeerTubeSocket } from '@server/lib/peertube-socket'
import { RunnerJobModel } from '@server/models/runner/runner-job'
import { setAsUpdated } from '@server/models/shared'
import { MRunnerJob } from '@server/types/models/runners'
import { pick } from '@shared/core-utils'
import {
  RunnerJobLiveRTMPHLSTranscodingPayload,
  RunnerJobLiveRTMPHLSTranscodingPrivatePayload,
  RunnerJobState,
  RunnerJobSuccessPayload,
  RunnerJobType,
  RunnerJobUpdatePayload,
  RunnerJobStudioTranscodingPayload,
  RunnerJobVideoStudioTranscodingPrivatePayload,
  RunnerJobVODAudioMergeTranscodingPayload,
  RunnerJobVODAudioMergeTranscodingPrivatePayload,
  RunnerJobVODHLSTranscodingPayload,
  RunnerJobVODHLSTranscodingPrivatePayload,
  RunnerJobVODWebVideoTranscodingPayload,
  RunnerJobVODWebVideoTranscodingPrivatePayload
} from '@shared/models'

type CreateRunnerJobArg =
  {
    type: Extract<RunnerJobType, 'vod-web-video-transcoding'>
    payload: RunnerJobVODWebVideoTranscodingPayload
    privatePayload: RunnerJobVODWebVideoTranscodingPrivatePayload
  } |
  {
    type: Extract<RunnerJobType, 'vod-hls-transcoding'>
    payload: RunnerJobVODHLSTranscodingPayload
    privatePayload: RunnerJobVODHLSTranscodingPrivatePayload
  } |
  {
    type: Extract<RunnerJobType, 'vod-audio-merge-transcoding'>
    payload: RunnerJobVODAudioMergeTranscodingPayload
    privatePayload: RunnerJobVODAudioMergeTranscodingPrivatePayload
  } |
  {
    type: Extract<RunnerJobType, 'live-rtmp-hls-transcoding'>
    payload: RunnerJobLiveRTMPHLSTranscodingPayload
    privatePayload: RunnerJobLiveRTMPHLSTranscodingPrivatePayload
  } |
  {
    type: Extract<RunnerJobType, 'video-studio-transcoding'>
    payload: RunnerJobStudioTranscodingPayload
    privatePayload: RunnerJobVideoStudioTranscodingPrivatePayload
  }

export abstract class AbstractJobHandler <C, U extends RunnerJobUpdatePayload, S extends RunnerJobSuccessPayload> {

  protected readonly lTags = loggerTagsFactory('runner')

  static setJobAsUpdatedThrottled = throttle(setAsUpdated, 2000)

  // ---------------------------------------------------------------------------

  abstract create (options: C): Promise<MRunnerJob>

  protected async createRunnerJob (options: CreateRunnerJobArg & {
    jobUUID: string
    priority: number
    dependsOnRunnerJob?: MRunnerJob
  }): Promise<MRunnerJob> {
    const { priority, dependsOnRunnerJob } = options

    logger.debug('Creating runner job', { options, ...this.lTags(options.type) })

    const runnerJob = new RunnerJobModel({
      ...pick(options, [ 'type', 'payload', 'privatePayload' ]),

      uuid: options.jobUUID,

      state: dependsOnRunnerJob
        ? RunnerJobState.WAITING_FOR_PARENT_JOB
        : RunnerJobState.PENDING,

      dependsOnRunnerJobId: dependsOnRunnerJob?.id,

      priority
    })

    const job = await sequelizeTypescript.transaction(async transaction => {
      return runnerJob.save({ transaction })
    })

    if (runnerJob.state === RunnerJobState.PENDING) {
      PeerTubeSocket.Instance.sendAvailableJobsPingToRunners()
    }

    return job
  }

  // ---------------------------------------------------------------------------

  protected abstract specificUpdate (options: {
    runnerJob: MRunnerJob
    updatePayload?: U
  }): Promise<void> | void

  async update (options: {
    runnerJob: MRunnerJob
    progress?: number
    updatePayload?: U
  }) {
    const { runnerJob, progress } = options

    await this.specificUpdate(options)

    if (progress) runnerJob.progress = progress

    if (!runnerJob.changed()) {
      try {
        await AbstractJobHandler.setJobAsUpdatedThrottled({ sequelize: sequelizeTypescript, table: 'runnerJob', id: runnerJob.id })
      } catch (err) {
        logger.warn('Cannot set remote job as updated', { err, ...this.lTags(runnerJob.id, runnerJob.type) })
      }

      return
    }

    await retryTransactionWrapper(() => {
      return sequelizeTypescript.transaction(async transaction => {
        return runnerJob.save({ transaction })
      })
    })
  }

  // ---------------------------------------------------------------------------

  async complete (options: {
    runnerJob: MRunnerJob
    resultPayload: S
  }) {
    const { runnerJob } = options

    try {
      await this.specificComplete(options)

      runnerJob.state = RunnerJobState.COMPLETED
    } catch (err) {
      logger.error('Cannot complete runner job', { err, ...this.lTags(runnerJob.id, runnerJob.type) })

      runnerJob.state = RunnerJobState.ERRORED
      runnerJob.error = err.message
    }

    runnerJob.progress = null
    runnerJob.finishedAt = new Date()

    await retryTransactionWrapper(() => {
      return sequelizeTypescript.transaction(async transaction => {
        await runnerJob.save({ transaction })
      })
    })

    const [ affectedCount ] = await RunnerJobModel.updateDependantJobsOf(runnerJob)

    if (affectedCount !== 0) PeerTubeSocket.Instance.sendAvailableJobsPingToRunners()
  }

  protected abstract specificComplete (options: {
    runnerJob: MRunnerJob
    resultPayload: S
  }): Promise<void> | void

  // ---------------------------------------------------------------------------

  async cancel (options: {
    runnerJob: MRunnerJob
    fromParent?: boolean
  }) {
    const { runnerJob, fromParent } = options

    await this.specificCancel(options)

    const cancelState = fromParent
      ? RunnerJobState.PARENT_CANCELLED
      : RunnerJobState.CANCELLED

    runnerJob.setToErrorOrCancel(cancelState)

    await retryTransactionWrapper(() => {
      return sequelizeTypescript.transaction(async transaction => {
        await runnerJob.save({ transaction })
      })
    })

    const children = await RunnerJobModel.listChildrenOf(runnerJob)
    for (const child of children) {
      logger.info(`Cancelling child job ${child.uuid} of ${runnerJob.uuid} because of parent cancel`, this.lTags(child.uuid))

      await this.cancel({ runnerJob: child, fromParent: true })
    }
  }

  protected abstract specificCancel (options: {
    runnerJob: MRunnerJob
  }): Promise<void> | void

  // ---------------------------------------------------------------------------

  protected abstract isAbortSupported (): boolean

  async abort (options: {
    runnerJob: MRunnerJob
  }) {
    const { runnerJob } = options

    if (this.isAbortSupported() !== true) {
      return this.error({ runnerJob, message: 'Job has been aborted but it is not supported by this job type' })
    }

    await this.specificAbort(options)

    runnerJob.resetToPending()

    await retryTransactionWrapper(() => {
      return sequelizeTypescript.transaction(async transaction => {
        await runnerJob.save({ transaction })
      })
    })
  }

  protected setAbortState (runnerJob: MRunnerJob) {
    runnerJob.resetToPending()
  }

  protected abstract specificAbort (options: {
    runnerJob: MRunnerJob
  }): Promise<void> | void

  // ---------------------------------------------------------------------------

  async error (options: {
    runnerJob: MRunnerJob
    message: string
    fromParent?: boolean
  }) {
    const { runnerJob, message, fromParent } = options

    const errorState = fromParent
      ? RunnerJobState.PARENT_ERRORED
      : RunnerJobState.ERRORED

    const nextState = errorState === RunnerJobState.ERRORED && this.isAbortSupported() && runnerJob.failures < RUNNER_JOBS.MAX_FAILURES
      ? RunnerJobState.PENDING
      : errorState

    await this.specificError({ ...options, nextState })

    if (nextState === errorState) {
      runnerJob.setToErrorOrCancel(nextState)
      runnerJob.error = message
    } else {
      runnerJob.resetToPending()
    }

    await retryTransactionWrapper(() => {
      return sequelizeTypescript.transaction(async transaction => {
        await runnerJob.save({ transaction })
      })
    })

    if (runnerJob.state === errorState) {
      const children = await RunnerJobModel.listChildrenOf(runnerJob)

      for (const child of children) {
        logger.info(`Erroring child job ${child.uuid} of ${runnerJob.uuid} because of parent error`, this.lTags(child.uuid))

        await this.error({ runnerJob: child, message: 'Parent error', fromParent: true })
      }
    }
  }

  protected abstract specificError (options: {
    runnerJob: MRunnerJob
    message: string
    nextState: RunnerJobState
  }): Promise<void> | void
}
