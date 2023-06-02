import { FFmpegCommandWrapper, FFmpegCommandWrapperOptions } from './ffmpeg-command-wrapper'
import { getVideoStreamDuration } from './ffprobe'

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

  async generateThumbnailFromVideo (options: {
    fromPath: string
    output: string
  }) {
    const { fromPath, output } = options

    let duration = await getVideoStreamDuration(fromPath)
    if (isNaN(duration)) duration = 0

    this.commandWrapper.buildCommand(fromPath)
      .seekInput(duration / 2)
      .videoFilter('thumbnail=500')
      .outputOption('-frames:v 1')
      .output(output)

    return this.commandWrapper.runCommand()
  }

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
