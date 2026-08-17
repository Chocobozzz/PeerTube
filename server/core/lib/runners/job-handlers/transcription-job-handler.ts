import {
  RunnerJobState,
  RunnerJobStateType,
  RunnerJobTranscriptionPayload,
  RunnerJobTranscriptionPrivatePayload,
  RunnerJobUpdatePayload,
  TranscriptionSuccess
} from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { createLogger } from '@server/helpers/logger.js'
import { JOB_PRIORITY } from '@server/initializers/constants.js'
import { onTranscriptionEnded } from '@server/lib/video-captions.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { MVideoUUID } from '@server/types/models/index.js'
import { MRunnerJob } from '@server/types/models/runners/index.js'
import { generateRunnerTranscodingInputFileUrl } from '../runner-urls.js'
import { AbstractJobHandler } from './abstract-job-handler.js'
import { loadRunnerVideo } from './shared/utils.js'

const logger = createLogger('transcription')

type CreateOptions = {
  video: MVideoUUID
}

export class TranscriptionJobHandler extends AbstractJobHandler<CreateOptions, RunnerJobUpdatePayload, TranscriptionSuccess> {
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

    await VideoJobInfoModel.decrease(options.runnerJob.privatePayload.videoUUID, 'pendingTranscription')
  }

  protected async specificCancel (options: {
    runnerJob: MRunnerJob
  }) {
    await VideoJobInfoModel.decrease(options.runnerJob.privatePayload.videoUUID, 'pendingTranscription')
  }

  async create (options: CreateOptions) {
    const { video } = options

    const jobUUID = buildUUID()
    const payload: RunnerJobTranscriptionPayload = {
      input: {
        videoFileUrl: generateRunnerTranscodingInputFileUrl({ jobUUID, videoUUID: video.uuid, type: 'audio' })
      },
      output: {}
    }

    const privatePayload: RunnerJobTranscriptionPrivatePayload = {
      videoUUID: video.uuid
    }

    return logger.withContext([ jobUUID, video.uuid ], async () => {
      const job = await this.createRunnerJob({
        type: 'video-transcription',
        jobUUID,
        payload,
        privatePayload,
        priority: JOB_PRIORITY.TRANSCRIPTION
      })

      return job
    })
  }

  // ---------------------------------------------------------------------------

  protected async specificComplete (options: {
    runnerJob: MRunnerJob
    resultPayload: TranscriptionSuccess
  }) {
    const { runnerJob, resultPayload } = options

    const video = await loadRunnerVideo(runnerJob)
    if (!video) return

    await logger.withContext([ video.uuid ], async () => {
      await VideoJobInfoModel.decrease(options.runnerJob.privatePayload.videoUUID, 'pendingTranscription')

      await onTranscriptionEnded({
        video,
        language: resultPayload.inputLanguage,
        vttPath: resultPayload.vttFile as string
      })
    })
  }
}
