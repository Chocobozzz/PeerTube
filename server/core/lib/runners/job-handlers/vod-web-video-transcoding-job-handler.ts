import { pick } from '@peertube/peertube-core-utils'
import {
  RunnerJobUpdatePayload,
  RunnerJobVODWebVideoTranscodingPayload,
  RunnerJobVODWebVideoTranscodingPrivatePayload,
  VideoResolution,
  VODWebVideoTranscodingSuccess
} from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { VideoSourceModel } from '@server/models/video/video-source.js'
import { MVideoWithFile } from '@server/types/models/index.js'
import { MRunnerJob } from '@server/types/models/runners/index.js'
import { generateRunnerTranscodingInputFileUrl } from '../runner-urls.js'
import { AbstractVODTranscodingJobHandler } from './abstract-vod-transcoding-job-handler.js'
import { loadRunnerVideo, onVODWebVideoOrAudioMergeTranscodingJob } from './shared/utils.js'

type CreateOptions = {
  video: MVideoWithFile
  isNewVideo: boolean
  resolution: number
  fps: number
  priority: number
  deleteInputFileId: number | null
  canMoveVideoState: boolean
  dependsOnRunnerJob?: MRunnerJob
}

// oxlint-disable-next-line max-len
export class VODWebVideoTranscodingJobHandler
  extends AbstractVODTranscodingJobHandler<CreateOptions, RunnerJobUpdatePayload, VODWebVideoTranscodingSuccess>
{
  async create (options: CreateOptions) {
    const { video, resolution, fps, priority, dependsOnRunnerJob } = options

    const jobUUID = buildUUID()

    let hasSeparatedAudio = false
    if (CONFIG.TRANSCODING.ORIGINAL_FILE.KEEP) {
      const videoSource = await VideoSourceModel.loadLatest(video.id)
      if (!videoSource?.keptOriginalFilename) {
        const { separatedAudioFile } = video.getMaxQualityAudioAndVideoFiles()
        hasSeparatedAudio = !!separatedAudioFile
      }
    } else {
      const { separatedAudioFile } = video.getMaxQualityAudioAndVideoFiles()
      hasSeparatedAudio = !!separatedAudioFile
    }

    const payload: RunnerJobVODWebVideoTranscodingPayload = {
      input: {
        videoFileUrl: generateRunnerTranscodingInputFileUrl({
          jobUUID,
          videoUUID: video.uuid,
          type: resolution === VideoResolution.H_NOVIDEO
            ? 'audio'
            : 'video'
        }),

        separatedAudioFileUrl: hasSeparatedAudio
          ? [ generateRunnerTranscodingInputFileUrl({ jobUUID, videoUUID: video.uuid, type: 'audio' }) ]
          : []
      },
      output: {
        resolution,
        fps
      }
    }

    const privatePayload: RunnerJobVODWebVideoTranscodingPrivatePayload = {
      ...pick(options, [ 'isNewVideo', 'deleteInputFileId', 'canMoveVideoState' ]),

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

    const video = await loadRunnerVideo(runnerJob, this.lTags)
    if (!video) return

    const videoFilePath = resultPayload.videoFile as string

    await onVODWebVideoOrAudioMergeTranscodingJob({ video, videoFilePath, privatePayload, wasAudioFile: false })

    logger.info(
      'Runner VOD web video transcoding job %s for %s ended.',
      runnerJob.uuid,
      video.uuid,
      this.lTags(video.uuid, runnerJob.uuid)
    )
  }
}
