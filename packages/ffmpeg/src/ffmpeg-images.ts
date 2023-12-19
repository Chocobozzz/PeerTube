import { FfprobeData } from 'fluent-ffmpeg'
import { FFmpegCommandWrapper, FFmpegCommandWrapperOptions } from './ffmpeg-command-wrapper.js'
import { getVideoStreamDuration } from './ffprobe.js'

export class FFmpegImage {
  private readonly commandWrapper: FFmpegCommandWrapper

  constructor (options: FFmpegCommandWrapperOptions) {
    this.commandWrapper = new FFmpegCommandWrapper(options)
  }

  convertWebPToJPG (options: {
    path: string
    destination: string
  }): Promise<void> {
    const { path, destination } = options

    this.commandWrapper.buildCommand(path)
      .output(destination)

    return this.commandWrapper.runCommand({ silent: true })
  }

  processGIF (options: {
    path: string
    destination: string
    newSize: { width: number, height: number }
  }): Promise<void> {
    const { path, destination, newSize } = options

    this.commandWrapper.buildCommand(path)
      .fps(20)
      .size(`${newSize.width}x${newSize.height}`)
      .output(destination)

    return this.commandWrapper.runCommand()
  }

  // ---------------------------------------------------------------------------

  async generateThumbnailFromVideo (options: {
    fromPath: string
    output: string
    framesToAnalyze: number
    ffprobe?: FfprobeData
  }) {
    const { fromPath, ffprobe } = options

    let duration = await getVideoStreamDuration(fromPath, ffprobe)
    if (isNaN(duration)) duration = 0

    this.buildGenerateThumbnailFromVideo(options)
      .seekInput(duration / 2)

    try {
      return await this.commandWrapper.runCommand()
    } catch (err) {
      this.commandWrapper.debugLog('Cannot generate thumbnail from video using seek input, fallback to no seek', { err })

      this.commandWrapper.resetCommand()

      this.buildGenerateThumbnailFromVideo(options)

      return this.commandWrapper.runCommand()
    }
  }

  private buildGenerateThumbnailFromVideo (options: {
    fromPath: string
    output: string
    framesToAnalyze: number
  }) {
    const { fromPath, output, framesToAnalyze } = options

    return this.commandWrapper.buildCommand(fromPath)
      .videoFilter('thumbnail=' + framesToAnalyze)
      .outputOption('-frames:v 1')
      .outputOption('-abort_on empty_output')
      .output(output)
  }

  // ---------------------------------------------------------------------------

  async generateStoryboardFromVideo (options: {
    path: string
    destination: string

    sprites: {
      size: {
        width: number
        height: number
      }

      count: {
        width: number
        height: number
      }

      duration: number
    }
  }) {
    const { path, destination, sprites } = options

    const command = this.commandWrapper.buildCommand(path)

    const filter = [
      `setpts=N/round(FRAME_RATE)/TB`,
      `select='not(mod(t,${options.sprites.duration}))'`,
      `scale=${sprites.size.width}:${sprites.size.height}`,
      `tile=layout=${sprites.count.width}x${sprites.count.height}`
    ].join(',')

    command.outputOption('-filter_complex', filter)
    command.outputOption('-frames:v', '1')
    command.outputOption('-q:v', '2')
    command.output(destination)

    return this.commandWrapper.runCommand()
  }
}
