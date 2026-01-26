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

    coverPath?: string
  }) {
    const { inputs, output, logError, coverPath } = options

    const command = this.commandWrapper.buildCommand(inputs)

    for (let i = 0; i < inputs.length; i++) {
      command.outputOption('-map ' + i)
    }

    if (coverPath) {
      command.addInput(coverPath)
      command.outputOption('-map ' + inputs.length)
    }

    command.outputOption('-c copy')
      .outputOption('-movflags frag_every_frame+empty_moov')
      .outputOption('-min_frag_duration 5M') // 5 seconds
      .format('mp4')
      .output(output)

    return this.commandWrapper.runCommand({ silent: !logError })
  }

  forceKill () {
    if (!this.commandWrapper) return

    this.commandWrapper.getCommand().kill('SIGKILL')
  }
}
