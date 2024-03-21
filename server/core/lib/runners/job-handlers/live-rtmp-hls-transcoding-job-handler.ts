import {
  LiveRTMPHLSTranscodingSuccess,
  LiveRTMPHLSTranscodingUpdatePayload,
  LiveVideoError,
  RunnerJobLiveRTMPHLSTranscodingPayload,
  RunnerJobLiveRTMPHLSTranscodingPrivatePayload,
  RunnerJobStateType
} from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { tryAtomicMove } from '@server/helpers/fs.js'
import { logger } from '@server/helpers/logger.js'
import { JOB_PRIORITY } from '@server/initializers/constants.js'
import { LiveManager } from '@server/lib/live/index.js'
import { MStreamingPlaylist, MVideo } from '@server/types/models/index.js'
import { MRunnerJob } from '@server/types/models/runners/index.js'
import { remove } from 'fs-extra/esm'
import { join } from 'path'
import { AbstractJobHandler } from './abstract-job-handler.js'

type CreateOptions = {
  video: MVideo
  playlist: MStreamingPlaylist

  sessionId: string
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
    const { video, rtmpUrl, toTranscode, playlist, segmentDuration, segmentListSize, outputDirectory, sessionId } = options

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
      sessionId,
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
      await tryAtomicMove(
        updatePayload.videoChunkFile as string,
        join(outputDirectory, updatePayload.videoChunkFilename)
      )
    } else if (updatePayload.type === 'remove-chunk') {
      await remove(join(outputDirectory, updatePayload.videoChunkFilename))
    }

    if (updatePayload.resolutionPlaylistFile && updatePayload.resolutionPlaylistFilename) {
      await tryAtomicMove(
        updatePayload.resolutionPlaylistFile as string,
        join(outputDirectory, updatePayload.resolutionPlaylistFilename)
      )
    }

    if (updatePayload.masterPlaylistFile) {
      await tryAtomicMove(updatePayload.masterPlaylistFile as string, join(outputDirectory, privatePayload.masterPlaylistName))
    }

    logger.debug(
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
    nextState: RunnerJobStateType
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

    LiveManager.Instance.stopSessionOfVideo({
      videoUUID: privatePayload.videoUUID,
      expectedSessionId: privatePayload.sessionId,
      error: errorType[type]
    })

    logger.info('Runner live RTMP to HLS job %s for video %s %s.', runnerJob.uuid, videoUUID, type, this.lTags(runnerJob.uuid, videoUUID))
  }
}
