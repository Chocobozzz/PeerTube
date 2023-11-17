import { logger } from '@server/helpers/logger.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { MVideo } from '@server/types/models/index.js'
import { MRunnerJob } from '@server/types/models/runners/index.js'
import { pick } from '@peertube/peertube-core-utils'
import { buildUUID } from '@peertube/peertube-node-utils'
import {
  RunnerJobUpdatePayload,
  RunnerJobVODWebVideoTranscodingPayload,
  RunnerJobVODWebVideoTranscodingPrivatePayload,
  VODWebVideoTranscodingSuccess
} from '@peertube/peertube-models'
import { generateRunnerTranscodingVideoInputFileUrl } from '../runner-urls.js'
import { AbstractVODTranscodingJobHandler } from './abstract-vod-transcoding-job-handler.js'
import { loadTranscodingRunnerVideo, onVODWebVideoOrAudioMergeTranscodingJob } from './shared/index.js'

type CreateOptions = {
  video: MVideo
  isNewVideo: boolean
  resolution: number
  fps: number
  priority: number
  deleteInputFileId: number | null
  dependsOnRunnerJob?: MRunnerJob
}

// eslint-disable-next-line max-len
export class VODWebVideoTranscodingJobHandler extends AbstractVODTranscodingJobHandler<CreateOptions, RunnerJobUpdatePayload, VODWebVideoTranscodingSuccess> {

  async create (options: CreateOptions) {
    const { video, resolution, fps, priority, dependsOnRunnerJob } = options

    const jobUUID = buildUUID()
    const payload: RunnerJobVODWebVideoTranscodingPayload = {
      input: {
        videoFileUrl: generateRunnerTranscodingVideoInputFileUrl(jobUUID, video.uuid)
      },
      output: {
        resolution,
        fps
      }
    }

    const privatePayload: RunnerJobVODWebVideoTranscodingPrivatePayload = {
      ...pick(options, [ 'isNewVideo', 'deleteInputFileId' ]),

      videoUUID: video.uuid
    }

    const job = await this.createRunnerJob({
      type: 'vod-web-video-transcoding',
      jobUUID,
      payload,
      privatePayload,
      dependsOnRunnerJob,
      priority
    })

    await VideoJobInfoModel.increaseOrCreate(video.uuid, 'pendingTranscode')

    return job
  }

  // ---------------------------------------------------------------------------

  protected async specificComplete (options: {
    runnerJob: MRunnerJob
    resultPayload: VODWebVideoTranscodingSuccess
  }) {
    const { runnerJob, resultPayload } = options
    const privatePayload = runnerJob.privatePayload as RunnerJobVODWebVideoTranscodingPrivatePayload

    const video = await loadTranscodingRunnerVideo(runnerJob, this.lTags)
    if (!video) return

    const videoFilePath = resultPayload.videoFile as string

    await onVODWebVideoOrAudioMergeTranscodingJob({ video, videoFilePath, privatePayload })

    logger.info(
      'Runner VOD web video transcoding job %s for %s ended.',
      runnerJob.uuid, video.uuid, this.lTags(video.uuid, runnerJob.uuid)
    )
  }
}
