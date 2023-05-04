
import { retryTransactionWrapper } from '@server/helpers/database-utils'
import { logger } from '@server/helpers/logger'
import { moveToFailedTranscodingState, moveToNextState } from '@server/lib/video-state'
import { VideoJobInfoModel } from '@server/models/video/video-job-info'
import { MRunnerJob } from '@server/types/models/runners'
import { RunnerJobSuccessPayload, RunnerJobUpdatePayload, RunnerJobVODPrivatePayload } from '@shared/models'
import { AbstractJobHandler } from './abstract-job-handler'
import { loadTranscodingRunnerVideo } from './shared'

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
  }) {
    const video = await loadTranscodingRunnerVideo(options.runnerJob, this.lTags)
    if (!video) return

    await moveToFailedTranscodingState(video)

    await VideoJobInfoModel.decrease(video.uuid, 'pendingTranscode')
  }

  protected async specificCancel (options: {
    runnerJob: MRunnerJob
  }) {
    const { runnerJob } = options

    const video = await loadTranscodingRunnerVideo(options.runnerJob, this.lTags)
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
