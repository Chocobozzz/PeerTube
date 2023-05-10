import { move, remove } from 'fs-extra'
import { join } from 'path'
import { logger } from '@server/helpers/logger'
import { JOB_PRIORITY } from '@server/initializers/constants'
import { LiveManager } from '@server/lib/live'
import { MStreamingPlaylist, MVideo } from '@server/types/models'
import { MRunnerJob } from '@server/types/models/runners'
import { buildUUID } from '@shared/extra-utils'
import {
  LiveRTMPHLSTranscodingSuccess,
  LiveRTMPHLSTranscodingUpdatePayload,
  LiveVideoError,
  RunnerJobLiveRTMPHLSTranscodingPayload,
  RunnerJobLiveRTMPHLSTranscodingPrivatePayload,
  RunnerJobState
} from '@shared/models'
import { AbstractJobHandler } from './abstract-job-handler'

type CreateOptions = {
  video: MVideo
  playlist: MStreamingPlaylist

  rtmpUrl: string

  toTranscode: {
    resolution: number
    fps: number
  }[]

  segmentListSize: number
  segmentDuration: number

  outputDirectory: string
}

// eslint-disable-next-line max-len
export class LiveRTMPHLSTranscodingJobHandler extends AbstractJobHandler<CreateOptions, LiveRTMPHLSTranscodingUpdatePayload, LiveRTMPHLSTranscodingSuccess> {

  async create (options: CreateOptions) {
    const { video, rtmpUrl, toTranscode, playlist, segmentDuration, segmentListSize, outputDirectory } = options

    const jobUUID = buildUUID()
    const payload: RunnerJobLiveRTMPHLSTranscodingPayload = {
      input: {
        rtmpUrl
      },
      output: {
        toTranscode,
        segmentListSize,
        segmentDuration
      }
    }

    const privatePayload: RunnerJobLiveRTMPHLSTranscodingPrivatePayload = {
      videoUUID: video.uuid,
      masterPlaylistName: playlist.playlistFilename,
      outputDirectory
    }

    const job = await this.createRunnerJob({
      type: 'live-rtmp-hls-transcoding',
      jobUUID,
      payload,
      privatePayload,
      priority: JOB_PRIORITY.TRANSCODING
    })

    return job
  }

  // ---------------------------------------------------------------------------

  protected async specificUpdate (options: {
    runnerJob: MRunnerJob
    updatePayload: LiveRTMPHLSTranscodingUpdatePayload
  }) {
    const { runnerJob, updatePayload } = options

    const privatePayload = runnerJob.privatePayload as RunnerJobLiveRTMPHLSTranscodingPrivatePayload
    const outputDirectory = privatePayload.outputDirectory
    const videoUUID = privatePayload.videoUUID

    // Always process the chunk first before moving m3u8 that references this chunk
    if (updatePayload.type === 'add-chunk') {
      await move(
        updatePayload.videoChunkFile as string,
        join(outputDirectory, updatePayload.videoChunkFilename),
        { overwrite: true }
      )
    } else if (updatePayload.type === 'remove-chunk') {
      await remove(join(outputDirectory, updatePayload.videoChunkFilename))
    }

    if (updatePayload.resolutionPlaylistFile && updatePayload.resolutionPlaylistFilename) {
      await move(
        updatePayload.resolutionPlaylistFile as string,
        join(outputDirectory, updatePayload.resolutionPlaylistFilename),
        { overwrite: true }
      )
    }

    if (updatePayload.masterPlaylistFile) {
      await move(updatePayload.masterPlaylistFile as string, join(outputDirectory, privatePayload.masterPlaylistName), { overwrite: true })
    }

    logger.info(
      'Runner live RTMP to HLS job %s for %s updated.',
      runnerJob.uuid, videoUUID, { updatePayload, ...this.lTags(videoUUID, runnerJob.uuid) }
    )
  }

  // ---------------------------------------------------------------------------

  protected specificComplete (options: {
    runnerJob: MRunnerJob
  }) {
    return this.stopLive({
      runnerJob: options.runnerJob,
      type: 'ended'
    })
  }

  // ---------------------------------------------------------------------------

  protected isAbortSupported () {
    return false
  }

  protected specificAbort () {
    throw new Error('Not implemented')
  }

  protected specificError (options: {
    runnerJob: MRunnerJob
    nextState: RunnerJobState
  }) {
    return this.stopLive({
      runnerJob: options.runnerJob,
      type: 'errored'
    })
  }

  protected specificCancel (options: {
    runnerJob: MRunnerJob
  }) {
    return this.stopLive({
      runnerJob: options.runnerJob,
      type: 'cancelled'
    })
  }

  private stopLive (options: {
    runnerJob: MRunnerJob
    type: 'ended' | 'errored' | 'cancelled'
  }) {
    const { runnerJob, type } = options

    const privatePayload = runnerJob.privatePayload as RunnerJobLiveRTMPHLSTranscodingPrivatePayload
    const videoUUID = privatePayload.videoUUID

    const errorType = {
      ended: null,
      errored: LiveVideoError.RUNNER_JOB_ERROR,
      cancelled: LiveVideoError.RUNNER_JOB_CANCEL
    }

    LiveManager.Instance.stopSessionOf(privatePayload.videoUUID, errorType[type])

    logger.info('Runner live RTMP to HLS job %s for video %s %s.', runnerJob.uuid, videoUUID, type, this.lTags(runnerJob.uuid, videoUUID))
  }
}
