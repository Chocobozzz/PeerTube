import {
  RunnerJobState,
  RunnerJobStateType,
  RunnerJobSuccessPayload,
  RunnerJobUpdatePayload,
  RunnerJobVODPrivatePayload
} from '@peertube/peertube-models'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { logger } from '@server/helpers/logger.js'
import { moveToFailedTranscodingState, moveToNextState } from '@server/lib/video-state.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { MRunnerJob } from '@server/types/models/runners/index.js'
import { AbstractJobHandler } from './abstract-job-handler.js'
import { loadRunnerVideo } from './shared/utils.js'

// eslint-disable-next-line max-len
export abstract class AbstractVODTranscodingJobHandler <C, U extends RunnerJobUpdatePayload, S extends RunnerJobSuccessPayload> extends AbstractJobHandler<C, U, S> {

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

    const video = await loadRunnerVideo(options.runnerJob, this.lTags)
    if (!video) return

    await moveToFailedTranscodingState(video)

    await VideoJobInfoModel.decrease(video.uuid, 'pendingTranscode')
  }

  protected async specificCancel (options: {
    runnerJob: MRunnerJob
  }) {
    const { runnerJob } = options

    const video = await loadRunnerVideo(options.runnerJob, this.lTags)
    if (!video) return

    const pending = await VideoJobInfoModel.decrease(video.uuid, 'pendingTranscode')

    logger.debug(`Pending transcode decreased to ${pending} after cancel`, this.lTags(video.uuid))

    if (pending === 0) {
      logger.info(
        `All transcoding jobs of ${video.uuid} have been processed or canceled, moving it to its next state`,
        this.lTags(video.uuid)
      )

      const privatePayload = runnerJob.privatePayload as RunnerJobVODPrivatePayload
      await retryTransactionWrapper(moveToNextState, { video, isNewVideo: privatePayload.isNewVideo })
    }
  }
}
