import { FFmpegLive } from '@peertube/peertube-ffmpeg'
import { getFFmpegCommandWrapperOptions } from '@server/helpers/ffmpeg/index.js'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { VIDEO_LIVE } from '@server/initializers/constants.js'
import { VideoTranscodingProfilesManager } from '@server/lib/transcoding/default-transcoding-profiles.js'
import { FfmpegCommand } from 'fluent-ffmpeg'
import { getLiveSegmentTime } from '../../live-utils.js'
import { AbstractTranscodingWrapper } from './abstract-transcoding-wrapper.js'

const logger = createLogger('live', 'transcoding', 'ffmpeg')

export class FFmpegTranscodingWrapper extends AbstractTranscodingWrapper {
  private ffmpegCommand: FfmpegCommand

  private aborted = false
  private errored = false
  private ended = false

  private exitTimeout: NodeJS.Timeout

  async run () {
    const ffmpegCommand = CONFIG.LIVE.TRANSCODING.ENABLED
      ? await this.buildFFmpegLive().getLiveTranscodingCommand({
        inputUrl: this.inputLocalUrl,

        outPath: this.outDirectory,
        masterPlaylistName: this.streamingPlaylist.playlistFilename,

        segmentListSize: this.segmentListSize,
        segmentDuration: this.segmentDuration,

        toTranscode: this.toTranscode,

        bitrate: this.bitrate,
        ratio: this.ratio,
        probe: this.probe,

        hasAudio: this.hasAudio,
        hasVideo: this.hasVideo,

        splitAudioAndVideo: true
      })
      : this.buildFFmpegLive().getLiveMuxingCommand({
        inputUrl: this.inputLocalUrl,
        outPath: this.outDirectory,

        masterPlaylistName: this.streamingPlaylist.playlistFilename,

        segmentListSize: this.segmentListSize,
        segmentDuration: getLiveSegmentTime(this.videoLive.latencyMode)
      })

    // abort() may have been called while we were building the command: don't spawn an ffmpeg process nobody watches
    if (this.aborted || this.ended || this.errored) {
      logger.debug('Live transcoding of %s was aborted before ffmpeg started.', this.videoUUID)
      return
    }

    this.ffmpegCommand = ffmpegCommand

    logger.info('Running local live muxing/transcoding for %s.', this.videoUUID)

    let ffmpegShellCommand: string
    this.ffmpegCommand.on('start', cmdline => {
      ffmpegShellCommand = cmdline

      logger.debug('Running ffmpeg command for live', { ffmpegShellCommand })
    })

    this.ffmpegCommand.on('error', (err, stdout, stderr) => {
      this.onFFmpegError({ err, stdout, stderr, ffmpegShellCommand })
    })

    this.ffmpegCommand.on('end', () => {
      this.onFFmpegEnded()
    })

    this.ffmpegCommand.run()
  }

  abort () {
    if (this.ended || this.errored || this.aborted) return

    this.aborted = true

    // ffmpeg was never started: there is nothing to wait for
    if (!this.ffmpegCommand) {
      this.emitEnded()
      return
    }

    logger.debug('Killing ffmpeg after live abort of ' + this.videoUUID)

    this.ffmpegCommand.kill('SIGINT')

    // Don't emit 'end' yet: on SIGINT ffmpeg still has to write its last segments and update the playlists
    // We wait for the process to actually exit so listeners know the live directory is not written anymore
    this.exitTimeout = setTimeout(() => {
      logger.warn('FFmpeg did not exit %d ms after SIGINT of %s, killing it.', VIDEO_LIVE.FFMPEG_EXIT_TIMEOUT, this.videoUUID)

      this.ffmpegCommand.kill('SIGKILL')
      this.emitEnded()
    }, VIDEO_LIVE.FFMPEG_EXIT_TIMEOUT)
  }

  destroy () {
    clearTimeout(this.exitTimeout)
  }

  private onFFmpegError (options: {
    err: any
    stdout: string
    stderr: string
    ffmpegShellCommand: string
  }) {
    const { err, stdout, stderr, ffmpegShellCommand } = options

    // We killed ffmpeg ourselves: it exits in error but has flushed its last segments, so this is a normal end for us
    if (this.aborted) {
      logger.debug(
        'Ignoring ffmpeg error of %s because we aborted the live.',
        this.videoUUID,
        { err, stdout, stderr, ffmpegShellCommand }
      )

      return this.emitEnded()
    }

    // Don't care that we killed the ffmpeg process
    if (err?.message?.includes('Exiting normally')) return
    if (this.ended || this.errored) return

    logger.error('FFmpeg transcoding error.', { err, stdout, stderr, ffmpegShellCommand })

    this.errored = true
    this.emit('error', { err })
  }

  private onFFmpegEnded () {
    if (this.errored) return

    logger.debug('Live ffmpeg transcoding ended for ' + this.videoUUID)

    this.emitEnded()
  }

  private emitEnded () {
    if (this.ended) return
    this.ended = true

    clearTimeout(this.exitTimeout)

    this.emit('end')
  }

  private buildFFmpegLive () {
    return new FFmpegLive(getFFmpegCommandWrapperOptions('live', VideoTranscodingProfilesManager.Instance.getAvailableEncoders()))
  }
}
