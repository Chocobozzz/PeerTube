import { move } from 'fs-extra'
import { dirname, join } from 'path'
import { logger } from '@server/helpers/logger'
import { renameVideoFileInPlaylist } from '@server/lib/hls'
import { getHlsResolutionPlaylistFilename } from '@server/lib/paths'
import { onTranscodingEnded } from '@server/lib/transcoding/ended-transcoding'
import { onHLSVideoFileTranscoding } from '@server/lib/transcoding/hls-transcoding'
import { buildNewFile, removeAllWebTorrentFiles } from '@server/lib/video-file'
import { VideoJobInfoModel } from '@server/models/video/video-job-info'
import { MVideo } from '@server/types/models'
import { MRunnerJob } from '@server/types/models/runners'
import { pick } from '@shared/core-utils'
import { buildUUID } from '@shared/extra-utils'
import {
  RunnerJobUpdatePayload,
  RunnerJobVODHLSTranscodingPayload,
  RunnerJobVODHLSTranscodingPrivatePayload,
  VODHLSTranscodingSuccess
} from '@shared/models'
import { generateRunnerTranscodingVideoInputFileUrl } from '../runner-urls'
import { AbstractVODTranscodingJobHandler } from './abstract-vod-transcoding-job-handler'
import { loadTranscodingRunnerVideo } from './shared'

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

    const videoFile = await buildNewFile({ path: videoFilePath, mode: 'hls' })
    const newVideoFilePath = join(dirname(videoFilePath), videoFile.filename)
    await move(videoFilePath, newVideoFilePath)

    const resolutionPlaylistFilename = getHlsResolutionPlaylistFilename(videoFile.filename)
    const newResolutionPlaylistFilePath = join(dirname(resolutionPlaylistFilePath), resolutionPlaylistFilename)
    await move(resolutionPlaylistFilePath, newResolutionPlaylistFilePath)

    await renameVideoFileInPlaylist(newResolutionPlaylistFilePath, videoFile.filename)

    await onHLSVideoFileTranscoding({
      video,
      videoFile,
      m3u8OutputPath: newResolutionPlaylistFilePath,
      videoOutputPath: newVideoFilePath
    })

    await onTranscodingEnded({ isNewVideo: privatePayload.isNewVideo, moveVideoToNextState: true, video })

    if (privatePayload.deleteWebVideoFiles === true) {
      logger.info('Removing web video files of %s now we have a HLS version of it.', video.uuid, this.lTags(video.uuid))

      await removeAllWebTorrentFiles(video)
    }

    logger.info('Runner VOD HLS job %s for %s ended.', runnerJob.uuid, video.uuid, this.lTags(runnerJob.uuid, video.uuid))
  }
}
