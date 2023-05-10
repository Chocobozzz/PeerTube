import { FfmpegCommand } from 'fluent-ffmpeg'
import { getFFmpegCommandWrapperOptions } from '@server/helpers/ffmpeg'
import { logger } from '@server/helpers/logger'
import { CONFIG } from '@server/initializers/config'
import { VIDEO_LIVE } from '@server/initializers/constants'
import { VideoTranscodingProfilesManager } from '@server/lib/transcoding/default-transcoding-profiles'
import { FFmpegLive } from '@shared/ffmpeg'
import { getLiveSegmentTime } from '../../live-utils'
import { AbstractTranscodingWrapper } from './abstract-transcoding-wrapper'

export class FFmpegTranscodingWrapper extends AbstractTranscodingWrapper {
  private ffmpegCommand: FfmpegCommand
  private ended = false

  async run () {
    this.ffmpegCommand = CONFIG.LIVE.TRANSCODING.ENABLED
      ? await this.buildFFmpegLive().getLiveTranscodingCommand({
        inputUrl: this.inputUrl,

        outPath: this.outDirectory,
        masterPlaylistName: this.streamingPlaylist.playlistFilename,

        segmentListSize: this.segmentListSize,
        segmentDuration: this.segmentDuration,

        toTranscode: this.toTranscode,

        bitrate: this.bitrate,
        ratio: this.ratio,

        hasAudio: this.hasAudio
      })
      : this.buildFFmpegLive().getLiveMuxingCommand({
        inputUrl: this.inputUrl,
        outPath: this.outDirectory,

        masterPlaylistName: this.streamingPlaylist.playlistFilename,

        segmentListSize: VIDEO_LIVE.SEGMENTS_LIST_SIZE,
        segmentDuration: getLiveSegmentTime(this.videoLive.latencyMode)
      })

    logger.info('Running local live muxing/transcoding for %s.', this.videoUUID, this.lTags())

    this.ffmpegCommand.run()

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
    // Nothing to do, ffmpeg will automatically exit
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

    logger.error('FFmpeg transcoding error.', { err, stdout, stderr, ffmpegShellCommand, ...this.lTags() })

    this.emit('error', { err })
  }

  private onFFmpegEnded () {
    if (this.ended) return

    this.ended = true
    this.emit('end')
  }

  private buildFFmpegLive () {
    return new FFmpegLive(getFFmpegCommandWrapperOptions('live', VideoTranscodingProfilesManager.Instance.getAvailableEncoders()))
  }
}
