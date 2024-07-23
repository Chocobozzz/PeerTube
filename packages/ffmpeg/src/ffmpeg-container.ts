import { Readable, Writable } from 'stream'
import { FFmpegCommandWrapper, FFmpegCommandWrapperOptions } from './ffmpeg-command-wrapper.js'

export class FFmpegContainer {
  private readonly commandWrapper: FFmpegCommandWrapper

  constructor (options: FFmpegCommandWrapperOptions) {
    this.commandWrapper = new FFmpegCommandWrapper(options)
  }

  mergeInputs (options: {
    inputs: (Readable | string)[]
    output: Writable
    logError: boolean
  }) {
    const { inputs, output, logError } = options

    this.commandWrapper.buildCommand(inputs)
      .outputOption('-c copy')
      .outputOption('-movflags frag_keyframe+empty_moov')
      .format('mp4')
      .output(output)

    return this.commandWrapper.runCommand({ silent: !logError })
  }
}
