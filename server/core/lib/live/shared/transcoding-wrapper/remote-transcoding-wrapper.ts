import { createLogger } from '@server/helpers/logger.js'
import { VIDEO_LIVE } from '@server/initializers/constants.js'
import { LiveRTMPHLSTranscodingJobHandler } from '@server/lib/runners/index.js'
import { MRunnerJob } from '@server/types/models/runners/index.js'
import { AbstractTranscodingWrapper } from './abstract-transcoding-wrapper.js'

const logger = createLogger('live', 'transcoding', 'runner')

export class RemoteTranscodingWrapper extends AbstractTranscodingWrapper {
  private aborted = false

  private flushTimeout: NodeJS.Timeout

  async run () {
    const runnerJob = await new LiveRTMPHLSTranscodingJobHandler().create({
      rtmpUrl: this.inputPublicUrl,
      sessionId: this.sessionId,
      toTranscode: this.toTranscode,
      video: this.videoLive.Video,
      outputDirectory: this.outDirectory,
      playlist: this.streamingPlaylist,
      segmentListSize: this.segmentListSize,
      segmentDuration: this.segmentDuration
    })

    // abort() may have been called while we were creating the job
    if (this.aborted) {
      logger.debug('Cancelling remote live transcoding job of %s aborted before a runner processed it.', this.videoUUID)

      await this.cancelRunnerJob(runnerJob)
    }
  }

  abort () {
    if (this.aborted) return
    this.aborted = true

    logger.debug('Waiting for the remote runner of %s to flush its last chunks.', this.videoUUID)

    // The runner uploads its chunks with HTTP requests that the API writes in our output directory, independently of this wrapper
    // Add a delay to flush its last chunks before listeners consider the directory is not written anymore
    this.flushTimeout = setTimeout(() => this.emit('end'), VIDEO_LIVE.REMOTE_RUNNER_FLUSH_DELAY)
  }

  destroy () {
    clearTimeout(this.flushTimeout)
  }

  private async cancelRunnerJob (runnerJob: MRunnerJob) {
    try {
      await new LiveRTMPHLSTranscodingJobHandler().cancel({ runnerJob })
    } catch (err) {
      logger.error('Cannot cancel remote live transcoding job of %s.', this.videoUUID, { err })
    }
  }
}
