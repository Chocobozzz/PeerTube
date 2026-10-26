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

    // The cover can be in any image format (webp etc.) but the MP4 container doesn't support all of them, so convert it to JPEG
    // A cover is only added to audio inputs, so the cover is the only video stream to encode
    if (coverPath) {
      command.outputOption('-c:v mjpeg')
        .outputOption('-q:v 2')
        // Only keep the first frame of animated images
        // Don't use -frames:v 1 that also stops the audio stream
        .outputOption('-filter:v trim=end_frame=1')
    }

    command.outputOption('-movflags frag_every_frame+empty_moov')
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
