import { MutexInterface } from 'async-mutex'
import { FfprobeData } from 'fluent-ffmpeg'
import { Duplex, PassThrough, Readable, Stream, Writable } from 'node:stream'
import { FFmpegCommandWrapper, FFmpegCommandWrapperOptions } from './ffmpeg-command-wrapper.js'
import { getVideoStreamDuration } from './ffprobe.js'

async function streamToBuffer (readableStream: Stream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    readableStream.on('data', data => {
      if (typeof data === 'string') {
        chunks.push(Buffer.from(data, 'utf-8'))
      } else if (data instanceof Buffer) {
        chunks.push(data)
      } else {
        const jsonData = JSON.stringify(data)
        chunks.push(Buffer.from(jsonData, 'utf-8'))
      }
    })

    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks))
    })

    readableStream.on('error', reject)
  })
}
export class FFmpegImage {
  private readonly commandWrapper: FFmpegCommandWrapper

  constructor (options: FFmpegCommandWrapperOptions) {
    this.commandWrapper = new FFmpegCommandWrapper(options)
  }

  async processGIF (options: {
    source: string | Buffer
    destination: string | null
    newSize?: { width: number, height: number }
  }) {
    const { source, destination, newSize } = options

    const command = this.commandWrapper.buildCommand(source === 'string' ? source : Readable.from(source))

    if (newSize) command.size(`${newSize.width}x${newSize.height}`)

    const stream = new Duplex()
    command.output(destination ?? stream)

    await this.commandWrapper.runCommand()

    return streamToBuffer(stream)
  }

  // ---------------------------------------------------------------------------

  async generateThumbnailFromVideo (options: {
    fromPath: string
    output: string | null
    framesToAnalyze: number
    scale?: {
      width: number
      height: number
    }
    ffprobe?: FfprobeData
  }) {
    const { fromPath, ffprobe } = options

    let duration = await getVideoStreamDuration(fromPath, ffprobe)
    if (isNaN(duration)) duration = 0
    const outputPath = options.output
    const outputStream = new PassThrough()

    this.buildGenerateThumbnailFromVideo({ ...options, output: outputPath ?? outputStream })
      .seekInput(duration / 2)

    try {
      await this.commandWrapper.runCommand()

      return outputPath ?? await streamToBuffer(outputStream)
    } catch (err) {
      this.commandWrapper.debugLog('Cannot generate thumbnail from video using seek input, fallback to no seek', { err })

      this.commandWrapper.resetCommand()

      this.buildGenerateThumbnailFromVideo({ ...options, output: outputPath ?? outputStream })

      await this.commandWrapper.runCommand()

      return outputPath ?? await streamToBuffer(outputStream)
    }
  }

  private buildGenerateThumbnailFromVideo (options: {
    fromPath: string
    output: string | Writable
    framesToAnalyze: number
    scale?: {
      width: number
      height: number
    }
  }) {
    const { fromPath, output, framesToAnalyze, scale } = options

    const command = this.commandWrapper.buildCommand(fromPath)
      .videoFilter('thumbnail=' + framesToAnalyze)
      .outputOption('-frames:v 1')
      .outputOption('-q:v 5')
      .outputOption('-abort_on empty_output')

    if (output instanceof Writable) {
      command.outputOption('-f image2')
      command.pipe(output)
    } else {
      command.addOutput(output)
    }

    if (scale) {
      command.videoFilter(`scale=${scale.width}x${scale.height}:force_original_aspect_ratio=decrease`)
    }

    return command
  }

  // ---------------------------------------------------------------------------

  async generateStoryboardFromVideo (options: {
    path: string
    destination: string

    // Will be released after the ffmpeg started
    inputFileMutexReleaser: MutexInterface.Releaser

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
    const { path, destination, inputFileMutexReleaser, sprites } = options

    const command = this.commandWrapper.buildCommand(path, inputFileMutexReleaser)

    const filter = [
      // Fix "t" variable with some videos
      `setpts='N/FRAME_RATE/TB'`,
      // First frame or the time difference between the last and the current frame is enough for our sprite interval
      `select='isnan(prev_selected_t)+gte(t-prev_selected_t,${options.sprites.duration})'`,
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
