
import { basename } from 'path'
import { logger } from '@server/helpers/logger'
import { onVideoEditionEnded, safeCleanupStudioTMPFiles } from '@server/lib/video-studio'
import { MVideo } from '@server/types/models'
import { MRunnerJob } from '@server/types/models/runners'
import { buildUUID } from '@shared/extra-utils'
import {
  isVideoStudioTaskIntro,
  isVideoStudioTaskOutro,
  isVideoStudioTaskWatermark,
  RunnerJobState,
  RunnerJobUpdatePayload,
  RunnerJobVideoEditionTranscodingPayload,
  RunnerJobVideoEditionTranscodingPrivatePayload,
  VideoEditionTranscodingSuccess,
  VideoState,
  VideoStudioTaskPayload
} from '@shared/models'
import { generateRunnerEditionTranscodingVideoInputFileUrl, generateRunnerTranscodingVideoInputFileUrl } from '../runner-urls'
import { AbstractJobHandler } from './abstract-job-handler'
import { loadTranscodingRunnerVideo } from './shared'

type CreateOptions = {
  video: MVideo
  tasks: VideoStudioTaskPayload[]
  priority: number
}

// eslint-disable-next-line max-len
export class VideoEditionTranscodingJobHandler extends AbstractJobHandler<CreateOptions, RunnerJobUpdatePayload, VideoEditionTranscodingSuccess> {

  async create (options: CreateOptions) {
    const { video, priority, tasks } = options

    const jobUUID = buildUUID()
    const payload: RunnerJobVideoEditionTranscodingPayload = {
      input: {
        videoFileUrl: generateRunnerTranscodingVideoInputFileUrl(jobUUID, video.uuid)
      },
      tasks: tasks.map(t => {
        if (isVideoStudioTaskIntro(t) || isVideoStudioTaskOutro(t)) {
          return {
            ...t,

            options: {
              ...t.options,

              file: generateRunnerEditionTranscodingVideoInputFileUrl(jobUUID, video.uuid, basename(t.options.file))
            }
          }
        }

        if (isVideoStudioTaskWatermark(t)) {
          return {
            ...t,

            options: {
              ...t.options,

              file: generateRunnerEditionTranscodingVideoInputFileUrl(jobUUID, video.uuid, basename(t.options.file))
            }
          }
        }

        return t
      })
    }

    const privatePayload: RunnerJobVideoEditionTranscodingPrivatePayload = {
      videoUUID: video.uuid,
      originalTasks: tasks
    }

    const job = await this.createRunnerJob({
      type: 'video-edition-transcoding',
      jobUUID,
      payload,
      privatePayload,
      priority
    })

    return job
  }

  // ---------------------------------------------------------------------------

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

  protected async specificComplete (options: {
    runnerJob: MRunnerJob
    resultPayload: VideoEditionTranscodingSuccess
  }) {
    const { runnerJob, resultPayload } = options
    const privatePayload = runnerJob.privatePayload as RunnerJobVideoEditionTranscodingPrivatePayload

    const video = await loadTranscodingRunnerVideo(runnerJob, this.lTags)
    if (!video) {
      await safeCleanupStudioTMPFiles(privatePayload.originalTasks)

    }

    const videoFilePath = resultPayload.videoFile as string

    await onVideoEditionEnded({ video, editionResultPath: videoFilePath, tasks: privatePayload.originalTasks })

    logger.info(
      'Runner video edition transcoding job %s for %s ended.',
      runnerJob.uuid, video.uuid, this.lTags(video.uuid, runnerJob.uuid)
    )
  }

  protected specificError (options: {
    runnerJob: MRunnerJob
    nextState: RunnerJobState
  }) {
    if (options.nextState === RunnerJobState.ERRORED) {
      return this.specificErrorOrCancel(options)
    }

    return Promise.resolve()
  }

  protected specificCancel (options: {
    runnerJob: MRunnerJob
  }) {
    return this.specificErrorOrCancel(options)
  }

  private async specificErrorOrCancel (options: {
    runnerJob: MRunnerJob
  }) {
    const { runnerJob } = options

    const payload = runnerJob.privatePayload as RunnerJobVideoEditionTranscodingPrivatePayload
    await safeCleanupStudioTMPFiles(payload.originalTasks)

    const video = await loadTranscodingRunnerVideo(options.runnerJob, this.lTags)
    if (!video) return

    return video.setNewState(VideoState.PUBLISHED, false, undefined)
  }
}
