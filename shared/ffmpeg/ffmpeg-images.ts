import { FFmpegCommandWrapper, FFmpegCommandWrapperOptions } from './ffmpeg-command-wrapper'

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
    folder: string
    imageName: string
  }) {
    const { fromPath, folder, imageName } = options

    const pendingImageName = 'pending-' + imageName

    const thumbnailOptions = {
      filename: pendingImageName,
      count: 1,
      folder
    }

    return new Promise<string>((res, rej) => {
      this.commandWrapper.buildCommand(fromPath)
        .on('error', rej)
        .on('end', () => res(imageName))
        .thumbnail(thumbnailOptions)
    })
  }
}
