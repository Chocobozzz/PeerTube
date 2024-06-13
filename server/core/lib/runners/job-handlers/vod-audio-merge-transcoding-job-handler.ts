import { pick } from '@peertube/peertube-core-utils'
import {
  RunnerJobUpdatePayload,
  RunnerJobVODAudioMergeTranscodingPayload,
  RunnerJobVODWebVideoTranscodingPrivatePayload,
  VODAudioMergeTranscodingSuccess
} from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { logger } from '@server/helpers/logger.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { MVideo } from '@server/types/models/index.js'
import { MRunnerJob } from '@server/types/models/runners/index.js'
import { generateRunnerTranscodingVideoInputFileUrl, generateRunnerTranscodingVideoPreviewFileUrl } from '../runner-urls.js'
import { AbstractVODTranscodingJobHandler } from './abstract-vod-transcoding-job-handler.js'
import { loadRunnerVideo, onVODWebVideoOrAudioMergeTranscodingJob } from './shared/utils.js'

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
export class VODAudioMergeTranscodingJobHandler extends AbstractVODTranscodingJobHandler<CreateOptions, RunnerJobUpdatePayload, VODAudioMergeTranscodingSuccess> {

  async create (options: CreateOptions) {
    const { video, resolution, fps, priority, dependsOnRunnerJob } = options

    const jobUUID = buildUUID()
    const payload: RunnerJobVODAudioMergeTranscodingPayload = {
      input: {
        audioFileUrl: generateRunnerTranscodingVideoInputFileUrl(jobUUID, video.uuid),
        previewFileUrl: generateRunnerTranscodingVideoPreviewFileUrl(jobUUID, video.uuid)
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
      type: 'vod-audio-merge-transcoding',
      jobUUID,
      payload,
      privatePayload,
      priority,
      dependsOnRunnerJob
    })

    await VideoJobInfoModel.increaseOrCreate(video.uuid, 'pendingTranscode')

    return job
  }

  // ---------------------------------------------------------------------------

  protected async specificComplete (options: {
    runnerJob: MRunnerJob
    resultPayload: VODAudioMergeTranscodingSuccess
  }) {
    const { runnerJob, resultPayload } = options
    const privatePayload = runnerJob.privatePayload as RunnerJobVODWebVideoTranscodingPrivatePayload

    const video = await loadRunnerVideo(runnerJob, this.lTags)
    if (!video) return

    const videoFilePath = resultPayload.videoFile as string

    await onVODWebVideoOrAudioMergeTranscodingJob({ video, videoFilePath, privatePayload, wasAudioFile: true })

    logger.info(
      'Runner VOD audio merge transcoding job %s for %s ended.',
      runnerJob.uuid, video.uuid, this.lTags(video.uuid, runnerJob.uuid)
    )
  }
}
