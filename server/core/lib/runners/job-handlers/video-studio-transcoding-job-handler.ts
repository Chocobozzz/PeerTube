import {
  RunnerJobState,
  RunnerJobStateType,
  RunnerJobStudioTranscodingPayload,
  RunnerJobUpdatePayload,
  RunnerJobVideoStudioTranscodingPrivatePayload,
  VideoStudioTaskPayload,
  VideoStudioTranscodingSuccess,
  isVideoStudioTaskIntro,
  isVideoStudioTaskOutro,
  isVideoStudioTaskWatermark
} from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { createLogger } from '@server/helpers/logger.js'
import { onVideoStudioEnded, onVideoStudioFailed, safeCleanupStudioTMPFiles } from '@server/lib/video-studio.js'
import { MVideoWithFile } from '@server/types/models/index.js'
import { MRunnerJob } from '@server/types/models/runners/index.js'
import { basename } from 'path'
import { generateRunnerEditionTranscodingVideoInputFileUrl, generateRunnerTranscodingInputFileUrl } from '../runner-urls.js'
import { AbstractJobHandler } from './abstract-job-handler.js'
import { loadRunnerVideo } from './shared/utils.js'

const logger = createLogger('studio', 'transcoding')

type CreateOptions = {
  video: MVideoWithFile
  sourceVideo?: MVideoWithFile
  tasks: VideoStudioTaskPayload[]
  priority: number
}

// oxlint-disable-next-line max-len
export class VideoStudioTranscodingJobHandler
  extends AbstractJobHandler<CreateOptions, RunnerJobUpdatePayload, VideoStudioTranscodingSuccess>
{
  async create (options: CreateOptions) {
    const { video, priority, tasks } = options
    const inputVideo = options.sourceVideo ?? video

    const jobUUID = buildUUID()
    const { separatedAudioFile } = inputVideo.getMaxQualityAudioAndVideoFiles()

    return logger.withContext([ jobUUID, video.uuid ], async () => {
      const payload: RunnerJobStudioTranscodingPayload = {
        input: {
          videoFileUrl: generateRunnerTranscodingInputFileUrl({ jobUUID, videoUUID: inputVideo.uuid, type: 'video' }),

          separatedAudioFileUrl: separatedAudioFile
            ? [ generateRunnerTranscodingInputFileUrl({ jobUUID, videoUUID: inputVideo.uuid, type: 'audio' }) ]
            : []
        },
        output: {},
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

      const privatePayload: RunnerJobVideoStudioTranscodingPrivatePayload = {
        videoUUID: video.uuid,
        sourceVideoUUID: options.sourceVideo?.uuid,
        originalTasks: tasks
      }

      const job = await this.createRunnerJob({
        type: 'video-studio-transcoding',
        jobUUID,
        payload,
        privatePayload,
        priority
      })

      return job
    })
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
    resultPayload: VideoStudioTranscodingSuccess
  }) {
    const { runnerJob, resultPayload } = options
    const privatePayload = runnerJob.privatePayload as RunnerJobVideoStudioTranscodingPrivatePayload

    const video = await loadRunnerVideo(runnerJob)
    if (!video) {
      await safeCleanupStudioTMPFiles(privatePayload.originalTasks)
      return
    }

    await logger.withContext([ video.uuid ], async () => {
      const videoFilePath = resultPayload.videoFile as string

      try {
        await onVideoStudioEnded({
          video,
          editionResultPath: videoFilePath,
          tasks: privatePayload.originalTasks,
          isNewVideo: !!privatePayload.sourceVideoUUID
        })
      } catch (err) {
        // The runner job has errored: don't keep an incomplete new video
        if (privatePayload.sourceVideoUUID) {
          await onVideoStudioFailed({ videoUUID: video.uuid, isNewVideo: true })
          await safeCleanupStudioTMPFiles(privatePayload.originalTasks)
        }

        throw err
      }

      logger.info('Runner video edition transcoding job %s for %s ended.', runnerJob.uuid, video.uuid)
    })
  }

  protected specificError (options: {
    runnerJob: MRunnerJob
    nextState: RunnerJobStateType
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

    const payload = runnerJob.privatePayload as RunnerJobVideoStudioTranscodingPrivatePayload

    await onVideoStudioFailed({ videoUUID: payload.videoUUID, isNewVideo: !!payload.sourceVideoUUID })

    await logger.withContext([ payload.videoUUID ], () => safeCleanupStudioTMPFiles(payload.originalTasks))
  }
}
