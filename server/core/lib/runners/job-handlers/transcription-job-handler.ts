import {
  RunnerJobState,
  RunnerJobStateType,
  RunnerJobTranscriptionPayload,
  RunnerJobTranscriptionPrivatePayload,
  RunnerJobUpdatePayload,
  TranscriptionSuccess
} from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { JOB_PRIORITY } from '@server/initializers/constants.js'
import { onTranscriptionEnded } from '@server/lib/video-captions.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { MVideoUUID } from '@server/types/models/index.js'
import { MRunnerJob } from '@server/types/models/runners/index.js'
import { generateRunnerTranscodingAudioInputFileUrl } from '../runner-urls.js'
import { AbstractJobHandler } from './abstract-job-handler.js'
import { loadRunnerVideo } from './shared/utils.js'

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
        videoFileUrl: generateRunnerTranscodingAudioInputFileUrl(jobUUID, video.uuid)
      },
      output: {}
    }

    const privatePayload: RunnerJobTranscriptionPrivatePayload = {
      videoUUID: video.uuid
    }

    const job = await this.createRunnerJob({
      type: 'video-transcription',
      jobUUID,
      payload,
      privatePayload,
      priority: JOB_PRIORITY.TRANSCODING
    })

    return job
  }

  // ---------------------------------------------------------------------------

  protected async specificComplete (options: {
    runnerJob: MRunnerJob
    resultPayload: TranscriptionSuccess
  }) {
    const { runnerJob, resultPayload } = options

    const video = await loadRunnerVideo(runnerJob, this.lTags)
    if (!video) return

    await onTranscriptionEnded({
      video,
      language: resultPayload.inputLanguage,
      vttPath: resultPayload.vttFile as string,
      lTags: this.lTags().tags
    })
  }
}
