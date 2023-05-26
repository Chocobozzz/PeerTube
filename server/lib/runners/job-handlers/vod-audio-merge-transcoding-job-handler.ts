import { pick } from 'lodash'
import { logger } from '@server/helpers/logger'
import { VideoJobInfoModel } from '@server/models/video/video-job-info'
import { MVideo } from '@server/types/models'
import { MRunnerJob } from '@server/types/models/runners'
import { buildUUID } from '@shared/extra-utils'
import { getVideoStreamDuration } from '@shared/ffmpeg'
import {
  RunnerJobUpdatePayload,
  RunnerJobVODAudioMergeTranscodingPayload,
  RunnerJobVODWebVideoTranscodingPrivatePayload,
  VODAudioMergeTranscodingSuccess
} from '@shared/models'
import { generateRunnerTranscodingVideoInputFileUrl, generateRunnerTranscodingVideoPreviewFileUrl } from '../runner-urls'
import { AbstractVODTranscodingJobHandler } from './abstract-vod-transcoding-job-handler'
import { loadTranscodingRunnerVideo, onVODWebVideoOrAudioMergeTranscodingJob } from './shared'

type CreateOptions = {
  video: MVideo
  isNewVideo: boolean
  resolution: number
  fps: number
  priority: number
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
      ...pick(options, [ 'isNewVideo' ]),

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

    const video = await loadTranscodingRunnerVideo(runnerJob, this.lTags)
    if (!video) return

    const videoFilePath = resultPayload.videoFile as string

    // ffmpeg generated a new video file, so update the video duration
    // See https://trac.ffmpeg.org/ticket/5456
    video.duration = await getVideoStreamDuration(videoFilePath)
    await video.save()

    // We can remove the old audio file
    const oldAudioFile = video.VideoFiles[0]
    await video.removeWebTorrentFile(oldAudioFile)
    await oldAudioFile.destroy()
    video.VideoFiles = []

    await onVODWebVideoOrAudioMergeTranscodingJob({ video, videoFilePath, privatePayload })

    logger.info(
      'Runner VOD audio merge transcoding job %s for %s ended.',
      runnerJob.uuid, video.uuid, this.lTags(video.uuid, runnerJob.uuid)
    )
  }
}
