import { logger } from '@server/helpers/logger.js'
import { onTranscodingEnded } from '@server/lib/transcoding/ended-transcoding.js'
import { onHLSVideoFileTranscoding } from '@server/lib/transcoding/hls-transcoding.js'
import { removeAllWebVideoFiles } from '@server/lib/video-file.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { MVideo } from '@server/types/models/index.js'
import { MRunnerJob } from '@server/types/models/runners/index.js'
import { pick } from '@peertube/peertube-core-utils'
import { buildUUID } from '@peertube/peertube-node-utils'
import {
  RunnerJobUpdatePayload,
  RunnerJobVODHLSTranscodingPayload,
  RunnerJobVODHLSTranscodingPrivatePayload,
  VODHLSTranscodingSuccess
} from '@peertube/peertube-models'
import { generateRunnerTranscodingVideoInputFileUrl } from '../runner-urls.js'
import { AbstractVODTranscodingJobHandler } from './abstract-vod-transcoding-job-handler.js'
import { loadTranscodingRunnerVideo } from './shared/index.js'

type CreateOptions = {
  video: MVideo
  isNewVideo: boolean
  deleteWebVideoFiles: boolean
  resolution: number
  fps: number
  priority: number
  dependsOnRunnerJob?: MRunnerJob
}

// eslint-disable-next-line max-len
export class VODHLSTranscodingJobHandler extends AbstractVODTranscodingJobHandler<CreateOptions, RunnerJobUpdatePayload, VODHLSTranscodingSuccess> {

  async create (options: CreateOptions) {
    const { video, resolution, fps, dependsOnRunnerJob, priority } = options

    const jobUUID = buildUUID()

    const payload: RunnerJobVODHLSTranscodingPayload = {
      input: {
        videoFileUrl: generateRunnerTranscodingVideoInputFileUrl(jobUUID, video.uuid)
      },
      output: {
        resolution,
        fps
      }
    }

    const privatePayload: RunnerJobVODHLSTranscodingPrivatePayload = {
      ...pick(options, [ 'isNewVideo', 'deleteWebVideoFiles' ]),

      videoUUID: video.uuid
    }

    const job = await this.createRunnerJob({
      type: 'vod-hls-transcoding',
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
    resultPayload: VODHLSTranscodingSuccess
  }) {
    const { runnerJob, resultPayload } = options
    const privatePayload = runnerJob.privatePayload as RunnerJobVODHLSTranscodingPrivatePayload

    const video = await loadTranscodingRunnerVideo(runnerJob, this.lTags)
    if (!video) return

    const videoFilePath = resultPayload.videoFile as string
    const resolutionPlaylistFilePath = resultPayload.resolutionPlaylistFile as string

    await onHLSVideoFileTranscoding({
      video,
      m3u8OutputPath: resolutionPlaylistFilePath,
      videoOutputPath: videoFilePath
    })

    await onTranscodingEnded({ isNewVideo: privatePayload.isNewVideo, moveVideoToNextState: true, video })

    if (privatePayload.deleteWebVideoFiles === true) {
      logger.info('Removing web video files of %s now we have a HLS version of it.', video.uuid, this.lTags(video.uuid))

      await removeAllWebVideoFiles(video)
    }

    logger.info('Runner VOD HLS job %s for %s ended.', runnerJob.uuid, video.uuid, this.lTags(runnerJob.uuid, video.uuid))
  }
}
