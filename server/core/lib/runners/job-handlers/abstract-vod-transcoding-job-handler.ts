import { RunnerJobState, RunnerJobStateType, RunnerJobSuccessPayload, RunnerJobUpdatePayload } from '@peertube/peertube-models'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { moveToFailedTranscodingState, moveToNextState } from '@server/lib/video-state.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { MRunnerJob } from '@server/types/models/runners/index.js'
import { AbstractJobHandler } from './abstract-job-handler.js'
import { loadRunnerVideo } from './shared/utils.js'

const logger = createLogger('vod', 'transcoding')

// oxlint-disable-next-line max-len
export abstract class AbstractVODTranscodingJobHandler<C, U extends RunnerJobUpdatePayload, S extends RunnerJobSuccessPayload>
  extends AbstractJobHandler<C, U, S>
{
  protected isAbortSupported () {
    return true
  }

  protected specificUpdate (_options: {
    runnerJob: MRunnerJob
  }) {
    // empty
  }

  protected specificAbort (_options: {
    runnerJob: MRunnerJob
  }) {
    // empty
  }

  protected async specificError (options: {
    runnerJob: MRunnerJob
    nextState: RunnerJobStateType
  }) {
    if (options.nextState !== RunnerJobState.ERRORED) return

    const video = await loadRunnerVideo(options.runnerJob)
    if (!video) return

    await logger.withContext([ video.uuid ], async () => {
      await moveToFailedTranscodingState(video)

      await VideoJobInfoModel.decrease(video.uuid, 'pendingTranscode')
    })
  }

  protected async specificCancel (options: {
    runnerJob: MRunnerJob
  }) {
    const { runnerJob } = options

    const video = await loadRunnerVideo(runnerJob)
    if (!video) return

    await logger.withContext([ video.uuid ], async () => {
      const pending = await VideoJobInfoModel.decrease(video.uuid, 'pendingTranscode')

      logger.debug(`Pending transcode decreased to ${pending} after cancel`)

      if (pending === 0) {
        logger.info(`All transcoding jobs of ${video.uuid} have been processed or canceled, moving it to its next state`)

        await retryTransactionWrapper(() => moveToNextState({ video }))
      }
    })
  }
}
