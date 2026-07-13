import { FFmpegContainer } from '@peertube/peertube-ffmpeg'
import { FileStorage } from '@peertube/peertube-models'
import { getFFmpegCommandWrapperOptions } from '@server/helpers/ffmpeg/ffmpeg-options.js'
import { logger } from '@server/helpers/logger.js'
import { buildRequestError, doRequestAndSaveToFile, generateRequestStream } from '@server/helpers/requests.js'
import { ThrottleStream } from '@server/helpers/stream-throttle.js'
import { REQUEST_TIMEOUTS } from '@server/initializers/constants.js'
import { isWebVideoFile, MVideoFile, MVideoThumbnails } from '@server/types/models/index.js'
import { createReadStream } from 'fs'
import { remove } from 'fs-extra/esm'
import { PassThrough, Readable, Writable } from 'stream'
import { pipeline } from 'stream/promises'
import { lTags } from './object-storage/shared/index.js'
import {
  getHLSFileReadStream,
  getWebVideoFileReadStream,
  makeHLSFileAvailable,
  makeWebVideoFileAvailable
} from './object-storage/videos.js'
import { VideoPathManager } from './video-path-manager.js'

export class VideoDownload {
  static totalDownloads = 0

  private readonly inputs: (string | Readable)[] = []

  private readonly tmpDestinations: string[] = []
  private ffmpegContainer: FFmpegContainer

  private readonly video: MVideoThumbnails
  private readonly videoFiles: MVideoFile[]

  private cleanupPromise: Promise<void>
  private allowDirectSending = true

  constructor (options: {
    video: MVideoThumbnails
    videoFiles: MVideoFile[]
  }) {
    this.video = options.video
    this.videoFiles = options.videoFiles
  }

  async muxToMergeVideoFiles (output: Writable, options?: {
    totalBytesPerSecond: number
    bytesPerIpPerSecond: number
    ip: string
  }) {
    const totalBytesPerSecond = options?.totalBytesPerSecond
    const bytesPerIpPerSecond = options?.bytesPerIpPerSecond
    const ip = options?.ip

    let rejectOnStreamError: (err: Error) => void
    const streamErrorPromise = new Promise<never>((_, rej) => {
      rejectOnStreamError = rej
    })

    const run = async () => {
      VideoDownload.totalDownloads++

      const maxResolution = await this.buildMuxInputs(rejectOnStreamError)

      // Include cover to audio file?
      const { coverPath, isTmpDestination } = maxResolution === 0
        ? await this.buildCoverInput()
        : { coverPath: undefined, isTmpDestination: false }

      if (coverPath && isTmpDestination) {
        this.tmpDestinations.push(coverPath)
      }

      // Prefer sending the file directly if possible
      if (this.allowDirectSending && !coverPath && this.inputs.length === 1) {
        logger.info(`Piping single file for video ${this.video.url}`, { input: this.inputsToLog()[0], ...lTags(this.video.uuid) })

        const input = typeof this.inputs[0] === 'string'
          ? createReadStream(this.inputs[0])
          : this.inputs[0]

        const throttleStream = totalBytesPerSecond || bytesPerIpPerSecond
          ? new ThrottleStream({ totalBytesPerSecond, bytesPerIpPerSecond, ip })
          : new PassThrough()

        try {
          await pipeline(input, throttleStream, output)
        } catch (err) {
          if ((err?.message || '').includes('Output stream closed')) {
            logger.info(`Client aborted direct download for video ${this.video.url}`, lTags(this.video.uuid))
            return
          }

          throw err
        }

        return
      }

      logger.info(`Muxing files for video ${this.video.url}`, { inputs: this.inputsToLog(), ...lTags(this.video.uuid) })

      this.ffmpegContainer = new FFmpegContainer(getFFmpegCommandWrapperOptions('vod'))

      const throttleStream = totalBytesPerSecond || bytesPerIpPerSecond
        ? new ThrottleStream({ totalBytesPerSecond, bytesPerIpPerSecond, ip })
        : undefined

      const finalOutput = throttleStream ?? output

      const throttlePipeline = throttleStream
        ? pipeline(throttleStream, output)
        : Promise.resolve()

      try {
        // Run in parallel to prevent throttlePipeline unhandled rejection if an input stream errors
        await Promise.all([
          this.ffmpegContainer.mergeInputs({
            inputs: this.inputs,
            output: finalOutput,
            logError: false,

            // Include a cover if this is an audio file
            coverPath
          }),

          throttlePipeline
        ])

        logger.info(`Mux ended for video ${this.video.url}`, { inputs: this.inputsToLog(), ...lTags(this.video.uuid) })
      } catch (err) {
        const message = err?.message || ''

        if (message.includes('Output stream closed')) {
          logger.info(`Client aborted mux for video ${this.video.url}`, lTags(this.video.uuid))
          return
        }

        if (err.inputStreamError) {
          err.inputStreamError = buildRequestError(err.inputStreamError)
        }

        logger.warn(`Cannot mux files of video ${this.video.url}`, { err, inputs: this.inputsToLog(), ...lTags(this.video.uuid) })

        throw err
      } finally {
        // cleanup() may already have force killed and unset ffmpegContainer if a stream errored and won the race below
        this.ffmpegContainer?.forceKill()
      }
    }

    try {
      // If a stream errors, don't wait for run() to notice: reject immediately so the caller isn't stuck
      // run() keeps executing in the background but will abort once cleanup() destroys its streams/ffmpeg process
      await Promise.race([ run(), streamErrorPromise ])
    } finally {
      this.cleanup()
        .catch(cleanupErr => logger.error('Cannot cleanup after mux error', { err: cleanupErr, ...lTags(this.video.uuid) }))
    }
  }

  // ---------------------------------------------------------------------------
  // Build mux inputs
  // ---------------------------------------------------------------------------

  private async buildMuxInputs (rej: (err: Error) => void) {
    let maxResolution = 0

    for (const videoFile of this.videoFiles) {
      if (!videoFile) continue

      if (!isWebVideoFile(videoFile)) {
        this.allowDirectSending = false
      }

      maxResolution = Math.max(maxResolution, videoFile.resolution)

      const { input, isTmpDestination } = await this.buildMuxInput(
        videoFile,
        errArg => {
          const err = buildRequestError(errArg as any)

          logger.warn(`Cannot build mux input of video ${this.video.url}`, {
            err,
            inputs: this.inputsToLog(),
            ...lTags(this.video.uuid)
          })

          // cleanup() is already run by muxToMergeVideoFiles's finally block once this rejection wins the race
          rej(err)
        }
      )

      this.inputs.push(input)

      if (isTmpDestination === true) this.tmpDestinations.push(input)
    }

    return maxResolution
  }

  private async buildMuxInput (
    videoFile: MVideoFile,
    onStreamError: (err: Error) => void
  ): Promise<{ input: Readable, isTmpDestination: false } | { input: string, isTmpDestination: boolean }> {
    // Remote
    if (this.video.remote === true) {
      return this.buildMuxRemoteInput(videoFile, onStreamError)
    }

    // Local on FS
    if (videoFile.storage === FileStorage.FILE_SYSTEM) {
      return this.buildMuxLocalFSInput(videoFile)
    }

    // Local on object storage
    return this.buildMuxLocalObjectStorageInput(videoFile)
  }

  private async buildMuxRemoteInput (videoFile: MVideoFile, onStreamError: (err: Error) => void) {
    const timeout = REQUEST_TIMEOUTS.VIDEO_FILE

    const videoSizeKB = videoFile.size / 1000
    const bodyKBLimit = videoSizeKB + 0.1 * videoSizeKB

    // FFmpeg doesn't support multiple input streams, so download the audio file on disk directly
    if (videoFile.isAudio()) {
      const destination = VideoPathManager.Instance.buildTMPDestination(videoFile.filename)

      // > 1GB
      if (bodyKBLimit > 1000 * 1000) {
        throw new Error('Cannot download remote video file > 1GB')
      }

      await doRequestAndSaveToFile(videoFile.fileUrl, destination, { timeout, bodyKBLimit })

      return { input: destination, isTmpDestination: true as const }
    }

    return {
      input: generateRequestStream(videoFile.fileUrl, { timeout, bodyKBLimit }).on('error', onStreamError),
      isTmpDestination: false as const
    }
  }

  private buildMuxLocalFSInput (videoFile: MVideoFile) {
    return { input: VideoPathManager.Instance.getFSVideoFileOutputPath(this.video, videoFile), isTmpDestination: false }
  }

  private async buildMuxLocalObjectStorageInput (videoFile: MVideoFile) {
    // FFmpeg doesn't support multiple input streams, so download the audio file on disk directly
    if (videoFile.hasAudio() && !videoFile.hasVideo()) {
      const destination = VideoPathManager.Instance.buildTMPDestination(videoFile.filename)

      if (videoFile.isHLS()) {
        await makeHLSFileAvailable(this.video, videoFile.filename, destination)
      } else {
        await makeWebVideoFileAvailable(videoFile.filename, destination)
      }

      return { input: destination, isTmpDestination: true as const }
    }

    if (videoFile.isHLS()) {
      const { stream } = await getHLSFileReadStream({
        video: this.video,
        filename: videoFile.filename,
        rangeHeader: undefined
      })

      return { input: stream, isTmpDestination: false as const }
    }

    // Web video
    const { stream } = await getWebVideoFileReadStream({
      filename: videoFile.filename,
      rangeHeader: undefined
    })

    return { input: stream, isTmpDestination: false as const }
  }

  // ---------------------------------------------------------------------------

  private async buildCoverInput () {
    const thumbnail = this.video.getBestThumbnail('16:9')

    if (this.video.isLocal()) return { coverPath: thumbnail?.getFSPath() }

    if (thumbnail?.fileUrl) {
      const destination = VideoPathManager.Instance.buildTMPDestination(thumbnail.filename)

      await doRequestAndSaveToFile(thumbnail.fileUrl, destination)

      return { coverPath: destination, isTmpDestination: true }
    }

    return { coverPath: undefined }
  }

  private inputsToLog () {
    return this.inputs.map(i => {
      if (typeof i === 'string') return i

      return 'ReadableStream'
    })
  }

  private async cleanup () {
    if (this.cleanupPromise === undefined) {
      this.cleanupPromise = this._doCleanup()
    }

    return this.cleanupPromise
  }

  private async _doCleanup () {
    VideoDownload.totalDownloads--

    for (const destination of this.tmpDestinations) {
      await remove(destination)
        .catch(err => logger.error('Cannot remove tmp destination', { err, destination, ...lTags(this.video.uuid) }))
    }

    for (const input of this.inputs) {
      if (input instanceof Readable) {
        if (!input.destroyed) input.destroy()
      }
    }

    if (this.ffmpegContainer) {
      this.ffmpegContainer.forceKill()
      this.ffmpegContainer = undefined
    }

    logger.debug(`Cleaned muxing for video ${this.video.url}`, { inputs: this.inputsToLog(), ...lTags(this.video.uuid) })
  }
}
