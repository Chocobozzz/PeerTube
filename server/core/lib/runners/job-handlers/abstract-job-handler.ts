import { exists, pick } from '@peertube/peertube-core-utils'
import {
  RunnerJobGenerateStoryboardPayload,
  RunnerJobGenerateStoryboardPrivatePayload,
  RunnerJobLiveRTMPHLSTranscodingPayload,
  RunnerJobLiveRTMPHLSTranscodingPrivatePayload,
  RunnerJobState,
  RunnerJobStateType,
  RunnerJobStudioTranscodingPayload,
  RunnerJobSuccessPayload,
  RunnerJobTranscriptionPayload,
  RunnerJobTranscriptionPrivatePayload,
  RunnerJobType,
  RunnerJobUpdatePayload,
  RunnerJobVODAudioMergeTranscodingPayload,
  RunnerJobVODAudioMergeTranscodingPrivatePayload,
  RunnerJobVODHLSTranscodingPayload,
  RunnerJobVODHLSTranscodingPrivatePayload,
  RunnerJobVODWebVideoTranscodingPayload,
  RunnerJobVODWebVideoTranscodingPrivatePayload,
  RunnerJobVideoStudioTranscodingPrivatePayload
} from '@peertube/peertube-models'
import { saveInTransactionWithRetries } from '@server/helpers/database-utils.js'
import { deleteFileAndCatch } from '@server/helpers/fs.js'
import { createLogger } from '@server/helpers/logger.js'
import { RUNNER_JOBS } from '@server/initializers/constants.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { PeerTubeSocket } from '@server/lib/peertube-socket.js'
import { RunnerJobModel } from '@server/models/runner/runner-job.js'
import { setAsUpdated } from '@server/models/shared/update.js'
import { MRunnerJob } from '@server/types/models/runners/index.js'
import { Transaction } from 'sequelize'

const logger = createLogger('runner')

type CreateRunnerJobArg =
  | {
    type: Extract<RunnerJobType, 'vod-web-video-transcoding'>
    payload: RunnerJobVODWebVideoTranscodingPayload
    privatePayload: RunnerJobVODWebVideoTranscodingPrivatePayload
  }
  | {
    type: Extract<RunnerJobType, 'vod-hls-transcoding'>
    payload: RunnerJobVODHLSTranscodingPayload
    privatePayload: RunnerJobVODHLSTranscodingPrivatePayload
  }
  | {
    type: Extract<RunnerJobType, 'vod-audio-merge-transcoding'>
    payload: RunnerJobVODAudioMergeTranscodingPayload
    privatePayload: RunnerJobVODAudioMergeTranscodingPrivatePayload
  }
  | {
    type: Extract<RunnerJobType, 'live-rtmp-hls-transcoding'>
    payload: RunnerJobLiveRTMPHLSTranscodingPayload
    privatePayload: RunnerJobLiveRTMPHLSTranscodingPrivatePayload
  }
  | {
    type: Extract<RunnerJobType, 'video-studio-transcoding'>
    payload: RunnerJobStudioTranscodingPayload
    privatePayload: RunnerJobVideoStudioTranscodingPrivatePayload
  }
  | {
    type: Extract<RunnerJobType, 'generate-video-storyboard'>
    payload: RunnerJobGenerateStoryboardPayload
    privatePayload: RunnerJobGenerateStoryboardPrivatePayload
  }
  | {
    type: Extract<RunnerJobType, 'video-transcription'>
    payload: RunnerJobTranscriptionPayload
    privatePayload: RunnerJobTranscriptionPrivatePayload
  }

export abstract class AbstractJobHandler<C, UpdatePayload extends RunnerJobUpdatePayload, SuccessPayload extends RunnerJobSuccessPayload> {
  abstract create (options: C): Promise<MRunnerJob>

  protected async createRunnerJob (
    options: CreateRunnerJobArg & {
      jobUUID: string
      priority: number
      dependsOnRunnerJob?: MRunnerJob
    }
  ): Promise<MRunnerJob> {
    const { priority, dependsOnRunnerJob } = options

    return logger.withContext([ options.type, options.jobUUID ], async () => {
      const runnerJob = new RunnerJobModel({
        ...pick(options, [ 'type', 'payload', 'privatePayload' ]),

        uuid: options.jobUUID,

        state: dependsOnRunnerJob
          ? RunnerJobState.WAITING_FOR_PARENT_JOB
          : RunnerJobState.PENDING,

        dependsOnRunnerJobId: dependsOnRunnerJob?.id,

        priority
      })

      await saveInTransactionWithRetries(runnerJob, Transaction.ISOLATION_LEVELS.READ_COMMITTED)

      logger.debug('Created runner job', { options, dependsOnRunnerJob })

      if (runnerJob.state === RunnerJobState.PENDING) {
        PeerTubeSocket.Instance.sendAvailableJobsPingToRunners()
      }

      return runnerJob
    })
  }

  // ---------------------------------------------------------------------------

  protected abstract specificUpdate (options: {
    runnerJob: MRunnerJob
    updatePayload?: UpdatePayload
  }): Promise<void> | void

  async update (options: {
    runnerJob: MRunnerJob
    progress?: number
    updatePayload?: UpdatePayload
  }) {
    const { runnerJob, progress } = options

    await logger.withContext([ runnerJob.uuid, runnerJob.type ], async () => {
      await this.specificUpdate(options)

      if (exists(progress)) runnerJob.progress = progress

      if (!runnerJob.changed()) {
        // Don't update updatedAt too often
        if (runnerJob.updatedAt.getTime() > Date.now() - 2000) return

        try {
          await setAsUpdated({ sequelize: sequelizeTypescript, table: 'runnerJob', id: runnerJob.id })
        } catch (err) {
          logger.warn('Cannot set remote job as updated', { err })
        }

        return
      }

      await saveInTransactionWithRetries(runnerJob)
    })
  }

  // ---------------------------------------------------------------------------

  async complete (options: {
    runnerJob: MRunnerJob
    resultPayload: SuccessPayload
  }) {
    const { runnerJob, resultPayload } = options

    await logger.withContext([ runnerJob.uuid, runnerJob.type ], async () => {
      runnerJob.state = RunnerJobState.COMPLETING
      await saveInTransactionWithRetries(runnerJob)

      try {
        await this.specificComplete(options)

        runnerJob.state = RunnerJobState.COMPLETED
      } catch (err) {
        logger.error('Cannot complete runner job', { err })

        runnerJob.state = RunnerJobState.ERRORED
        runnerJob.error = err.message
      } finally {
        // specificComplete() moves whatever uploaded file it consumes into permanent storage
        // Remove anything it left behind in tmp directory
        this.cleanupResultPayloadFiles(resultPayload)
      }

      runnerJob.progress = null
      runnerJob.finishedAt = new Date()

      await saveInTransactionWithRetries(runnerJob)

      const [ affectedCount ] = await RunnerJobModel.updateDependantJobsOf(runnerJob)

      if (affectedCount !== 0) PeerTubeSocket.Instance.sendAvailableJobsPingToRunners()
    })
  }

  private cleanupResultPayloadFiles (resultPayload: SuccessPayload) {
    // Possible uploaded file paths across all RunnerJobSuccessPayload variants
    const resultPayloadFileKeys = [ 'videoFile', 'resolutionPlaylistFile', 'vttFile', 'storyboardFile' ] as const

    for (const key of resultPayloadFileKeys) {
      const value = (resultPayload as Record<string, unknown>)?.[key]
      if (typeof value !== 'string') continue

      deleteFileAndCatch(value)
    }
  }

  protected abstract specificComplete (options: {
    runnerJob: MRunnerJob
    resultPayload: SuccessPayload
  }): Promise<void> | void

  // ---------------------------------------------------------------------------

  async cancel (options: {
    runnerJob: MRunnerJob
    fromParent?: boolean
  }) {
    const { runnerJob, fromParent } = options

    await logger.withContext([ runnerJob.uuid, runnerJob.type ], async () => {
      await this.specificCancel(options)

      const cancelState = fromParent
        ? RunnerJobState.PARENT_CANCELLED
        : RunnerJobState.CANCELLED

      runnerJob.setToErrorOrCancel(cancelState)

      await saveInTransactionWithRetries(runnerJob)

      const children = await RunnerJobModel.listChildrenOf(runnerJob)
      for (const child of children) {
        logger.info(`Cancelling child job ${child.uuid} of ${runnerJob.uuid} because of parent cancel`)

        await this.cancel({ runnerJob: child, fromParent: true })
      }
    })
  }

  protected abstract specificCancel (options: {
    runnerJob: MRunnerJob
  }): Promise<void> | void

  // ---------------------------------------------------------------------------

  protected abstract isAbortSupported (): boolean

  async abort (options: {
    runnerJob: MRunnerJob
    abortNotSupportedErrorMessage?: string
  }) {
    const { runnerJob, abortNotSupportedErrorMessage = 'Job has been aborted but it is not supported by this job type' } = options

    await logger.withContext([ runnerJob.uuid, runnerJob.type ], async () => {
      if (this.isAbortSupported() !== true) {
        return this.error({ runnerJob, message: abortNotSupportedErrorMessage })
      }

      await this.specificAbort(options)

      runnerJob.resetToPending()

      await saveInTransactionWithRetries(runnerJob)

      PeerTubeSocket.Instance.sendAvailableJobsPingToRunners()
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

    await logger.withContext([ runnerJob.uuid, runnerJob.type ], async () => {
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

      await saveInTransactionWithRetries(runnerJob)

      if (runnerJob.state === errorState) {
        const children = await RunnerJobModel.listChildrenOf(runnerJob)

        for (const child of children) {
          logger.info(`Erroring child job ${child.uuid} of ${runnerJob.uuid} because of parent error`)

          await this.error({ runnerJob: child, message: 'Parent error', fromParent: true })
        }
      } else {
        PeerTubeSocket.Instance.sendAvailableJobsPingToRunners()
      }
    })
  }

  protected abstract specificError (options: {
    runnerJob: MRunnerJob
    message: string
    nextState: RunnerJobStateType
  }): Promise<void> | void
}
