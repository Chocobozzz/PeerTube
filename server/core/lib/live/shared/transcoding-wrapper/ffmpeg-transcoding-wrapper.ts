import { FFmpegLive } from '@peertube/peertube-ffmpeg'
import { getFFmpegCommandWrapperOptions } from '@server/helpers/ffmpeg/index.js'
import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { VIDEO_LIVE } from '@server/initializers/constants.js'
import { VideoTranscodingProfilesManager } from '@server/lib/transcoding/default-transcoding-profiles.js'
import { FfmpegCommand } from 'fluent-ffmpeg'
import { getLiveSegmentTime } from '../../live-utils.js'
import { AbstractTranscodingWrapper } from './abstract-transcoding-wrapper.js'

export class FFmpegTranscodingWrapper extends AbstractTranscodingWrapper {
  private ffmpegCommand: FfmpegCommand

  private aborted = false
  private errored = false
  private ended = false

  async run () {
    this.ffmpegCommand = CONFIG.LIVE.TRANSCODING.ENABLED
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

        segmentListSize: VIDEO_LIVE.SEGMENTS_LIST_SIZE,
        segmentDuration: getLiveSegmentTime(this.videoLive.latencyMode)
      })

    logger.info('Running local live muxing/transcoding for %s.', this.videoUUID, this.lTags())

    let ffmpegShellCommand: string
    this.ffmpegCommand.on('start', cmdline => {
      ffmpegShellCommand = cmdline

      logger.debug('Running ffmpeg command for live', { ffmpegShellCommand, ...this.lTags() })
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

    logger.debug('Killing ffmpeg after live abort of ' + this.videoUUID, this.lTags())

    if (this.ffmpegCommand) {
      this.ffmpegCommand.kill('SIGINT')
    }

    this.aborted = true
    this.emit('end')
  }

  private onFFmpegError (options: {
    err: any
    stdout: string
    stderr: string
    ffmpegShellCommand: string
  }) {
    const { err, stdout, stderr, ffmpegShellCommand } = options

    // Don't care that we killed the ffmpeg process
    if (err?.message?.includes('Exiting normally')) return
    if (this.ended || this.errored || this.aborted) return

    logger.error('FFmpeg transcoding error.', { err, stdout, stderr, ffmpegShellCommand, ...this.lTags() })

    this.errored = true
    this.emit('error', { err })
  }

  private onFFmpegEnded () {
    if (this.ended || this.errored || this.aborted) return

    logger.debug('Live ffmpeg transcoding ended for ' + this.videoUUID, this.lTags())

    this.ended = true
    this.emit('end')
  }

  private buildFFmpegLive () {
    return new FFmpegLive(getFFmpegCommandWrapperOptions('live', VideoTranscodingProfilesManager.Instance.getAvailableEncoders()))
  }
}
