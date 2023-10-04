import { FfmpegCommand } from 'fluent-ffmpeg'
import { EncoderOptions } from '@peertube/peertube-models'
import { buildStreamSuffix } from '../ffmpeg-utils.js'

export function addDefaultEncoderGlobalParams (command: FfmpegCommand) {
  // avoid issues when transcoding some files: https://trac.ffmpeg.org/ticket/6375
  command.outputOption('-max_muxing_queue_size 1024')
         // strip all metadata
         .outputOption('-map_metadata -1')
         // allows import of source material with incompatible pixel formats (e.g. MJPEG video)
         .outputOption('-pix_fmt yuv420p')
}

export function addDefaultEncoderParams (options: {
  command: FfmpegCommand
  encoder: 'libx264' | string
  fps: number

  streamNum?: number
}) {
  const { command, encoder, fps, streamNum } = options

  if (encoder === 'libx264') {
    if (fps) {
      // Keyframe interval of 2 seconds for faster seeking and resolution switching.
      // https://streaminglearningcenter.com/blogs/whats-the-right-keyframe-interval.html
      // https://superuser.com/a/908325
      command.outputOption(buildStreamSuffix('-g:v', streamNum) + ' ' + (fps * 2))
    }
  }
}

export function applyEncoderOptions (command: FfmpegCommand, options: EncoderOptions) {
  command.inputOptions(options.inputOptions ?? [])
    .outputOptions(options.outputOptions ?? [])
}
