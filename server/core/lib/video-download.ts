import { FFmpegContainer } from '@peertube/peertube-ffmpeg'
import { FileStorage, HttpStatusCode } from '@peertube/peertube-models'
import { getFFmpegCommandWrapperOptions } from '@server/helpers/ffmpeg/ffmpeg-options.js'
import { createLogger } from '@server/helpers/logger.js'
import { buildRequestError, doRequestAndSaveToFile, generateRequestStream, PeerTubeRequestError } from '@server/helpers/requests.js'
import { ThrottleStream } from '@server/helpers/stream-throttle.js'
import { LRU_CACHE, REQUEST_TIMEOUTS } from '@server/initializers/constants.js'
import { isWebVideoFile, MVideoFile, MVideoThumbnails } from '@server/types/models/index.js'
import { createReadStream } from 'fs'
import { remove } from 'fs-extra/esm'
import { LRUCache } from 'lru-cache'
import { PassThrough, Readable, Writable } from 'stream'
import { pipeline } from 'stream/promises'
import { scheduleVideoRefreshIfNeeded } from './activitypub/videos/refresh.js'
import { makeCommonFileAvailableIn } from './object-storage/common-files.js'
import {
  getHLSFileReadStream,
  getWebVideoFileReadStream,
  makeHLSFileAvailable,
  makeWebVideoFileAvailable
} from './object-storage/videos.js'
import { VideoPathManager } from './video-path-manager.js'

const logger = createLogger('video-download')

// Remote hosts that recently failed -> error message
const remoteHostFailures = new LRUCache<string, string>({
  max: LRU_CACHE.REMOTE_HOST_FAILURES.MAX_SIZE,
  ttl: LRU_CACHE.REMOTE_HOST_FAILURES.TTL
})

export class VideoDownload {
  static totalDownloads = 0

  private readonly inputs: (string | Readable)[] = []

  private readonly tmpDestinations: string[] = []
  private ffmpegContainer: FFmpegContainer

  private readonly video: MVideoThumbnails
  private readonly videoFiles: MVideoFile[]

  // Aborted on cleanup, to cancel pending remote requests and stop the background run() as soon as possible
  private readonly abortController = new AbortController()

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
    return logger.withContext([ this.video.uuid ], async () => {
      const totalBytesPerSecond = options?.totalBytesPerSecond
      const bytesPerIpPerSecond = options?.bytesPerIpPerSecond
      const ip = options?.ip

      let rejectOnStreamError: (err: Error) => void
      const streamErrorPromise = new Promise<never>((_, rej) => {
        rejectOnStreamError = rej
      })

      // The client may abort the download while we are still preparing inputs (waiting for remote servers...)
      // Don't wait for run() to notice it
      let onOutputClose: () => void
      const outputClosedPromise = new Promise<void>(res => {
        onOutputClose = () => {
          if (output.writableFinished) return

          logger.info(`Client aborted download of video ${this.video.url}`)
          res()
        }
      })
      output.once('close', onOutputClose)

      const run = async () => {
        const maxResolution = await this.buildMuxInputs(rejectOnStreamError)

        // Include cover to audio file?
        const { coverPath, isTmpDestination } = maxResolution === 0
          ? await this.buildCoverInput()
          : { coverPath: undefined, isTmpDestination: false }

        if (coverPath && isTmpDestination) {
          this.addTmpDestination(coverPath)
        }

        // We may have been aborted while building inputs, don't spawn anything
        this.throwIfAborted()

        // Prefer sending the file directly if possible
        if (this.allowDirectSending && !coverPath && this.inputs.length === 1) {
          logger.info(`Piping single file for video ${this.video.url}`, { input: this.inputsToLog()[0] })

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
              logger.info(`Client aborted direct download for video ${this.video.url}`)
              return
            }

            throw err
          }

          return
        }

        logger.info(`Muxing files for video ${this.video.url}`, { inputs: this.inputsToLog() })

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

          logger.info(`Mux ended for video ${this.video.url}`, { inputs: this.inputsToLog() })
        } catch (err) {
          const message = err?.message || ''

          if (message.includes('Output stream closed')) {
            logger.info(`Client aborted mux for video ${this.video.url}`)
            return
          }

          // Killed by cleanup(): the reason (input error, client abort...) has already been handled
          if (this.isAborted()) return

          if (err.inputStreamError) {
            err.inputStreamError = buildRequestError(err.inputStreamError)
          }

          logger.warn(`Cannot mux files of video ${this.video.url}`, { err, inputs: this.inputsToLog() })

          throw err
        } finally {
          // ffmpegContainer.forceKill() also kills the process if it has not been spawned yet
          // cleanup() may already have force killed and unset ffmpegContainer if a stream errored and won the race below
          this.ffmpegContainer?.forceKill()
        }
      }

      VideoDownload.totalDownloads++
      // Release the download slot after run() that may still be doing work that cannot be aborted
      const runPromise = run().finally(() => VideoDownload.totalDownloads--)

      try {
        // If a stream errors or the client aborts the download, don't wait for run() to notice: settle immediately
        // run() keeps executing in the background but will abort once cleanup() aborts its requests and destroys its streams/ffmpeg process
        await Promise.race([ runPromise, streamErrorPromise, outputClosedPromise ])
      } finally {
        output.off('close', onOutputClose)

        this.cleanup()
          .catch(cleanupErr => logger.error('Cannot cleanup after mux error', { err: cleanupErr }))
      }
    })
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
          // Expected error: we aborted the request ourselves
          if (this.isAborted()) return

          const err = buildRequestError(errArg as any)

          logger.warn(`Cannot build mux input of video ${this.video.url}`, {
            err,
            inputs: this.inputsToLog()
          })

          // cleanup() is already run by muxToMergeVideoFiles's finally block once this rejection wins the race
          rej(err)
        }
      )

      this.addInput(input, isTmpDestination)
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
    const url = videoFile.fileUrl
    const signal = this.abortController.signal

    throwIfRecentRemoteHostFailure(url)

    const videoSizeKB = videoFile.size / 1000
    const bodyKBLimit = videoSizeKB + 0.1 * videoSizeKB

    // FFmpeg doesn't support multiple input streams, so the audio file is downloaded on disk
    if (videoFile.isAudio() && bodyKBLimit > 1000 * 1000) {
      throw new Error('Cannot download remote audio file > 1GB')
    }

    try {
      if (videoFile.isAudio()) {
        const destination = VideoPathManager.Instance.buildTMPDestination(videoFile.filename)

        await doRequestAndSaveToFile(url, destination, { timeout: REQUEST_TIMEOUTS.GENERATE_DOWNLOAD.AUDIO_FILE, bodyKBLimit, signal })

        return { input: destination, isTmpDestination: true as const }
      }

      const stream = generateRequestStream(url, {
        timeout: REQUEST_TIMEOUTS.GENERATE_DOWNLOAD.VIDEO_STREAM_UNTIL_RESPONSE,
        idleTimeout: REQUEST_TIMEOUTS.GENERATE_DOWNLOAD.VIDEO_STREAM_INACTIVITY,
        bodyKBLimit,
        signal
      }).on('error', onStreamError)

      // Wait for the remote response so request errors (HTTP error, DNS, connection refused...) are thrown before we write to the output
      // Otherwise the direct sending pipeline destroys the HTTP response before sending headers, and the reverse proxy returns a 502
      // It also prevents spawning a useless ffmpeg process
      await new Promise<void>((res, rej) => {
        stream.once('response', () => res())
        stream.once('error', err => rej(buildRequestError(err as any)))
      })

      return { input: stream, isTmpDestination: false as const }
    } catch (err) {
      if (!this.isAborted()) this.handleRemoteFailure(url, err)

      throw err
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

    if (this.video.isLocal()) {
      if (!thumbnail) return { coverPath: undefined }

      if (thumbnail.storage === FileStorage.OBJECT_STORAGE) {
        const destination = VideoPathManager.Instance.buildTMPDestination(thumbnail.filename)
        await makeCommonFileAvailableIn('thumbnails', thumbnail.filename, destination)

        return { coverPath: destination, isTmpDestination: true }
      }

      return { coverPath: thumbnail.getFSPath() }
    }

    if (thumbnail?.fileUrl) {
      const destination = VideoPathManager.Instance.buildTMPDestination(thumbnail.filename)

      await doRequestAndSaveToFile(thumbnail.fileUrl, destination, { signal: this.abortController.signal })

      return { coverPath: destination, isTmpDestination: true }
    }

    return { coverPath: undefined }
  }

  // ---------------------------------------------------------------------------

  private addInput (input: string | Readable, isTmpDestination: boolean) {
    this.inputs.push(input)

    if (isTmpDestination === true) this.addTmpDestination(input as string)
    else this.releaseResourcesIfAborted()
  }

  private addTmpDestination (destination: string) {
    this.tmpDestinations.push(destination)

    this.releaseResourcesIfAborted()
  }

  // run() keeps executing in the background after cleanup(): release resources it creates afterwards and stop it
  private releaseResourcesIfAborted () {
    if (!this.isAborted()) return

    this.releaseResources()
      .catch(err => logger.error('Cannot release resources of aborted download', { err }))

    this.throwIfAborted()
  }

  private isAborted () {
    return this.abortController.signal.aborted
  }

  private throwIfAborted () {
    if (this.isAborted()) throw new Error(`Download of video ${this.video.url} aborted`)
  }

  // ---------------------------------------------------------------------------

  private handleRemoteFailure (url: string, err: PeerTubeRequestError) {
    const statusCode = err?.statusCode

    // Outdated remote video?
    if (statusCode === HttpStatusCode.NOT_FOUND_404 || statusCode === HttpStatusCode.GONE_410) {
      scheduleVideoRefreshIfNeeded(this.video)
      return
    }

    if (!isRemoteHostFailure(err)) return

    // Don't request this host again for a while
    const host = getURLHost(url)
    if (!host) return

    remoteHostFailures.set(host, err?.message || 'Unknown error')
  }

  // ---------------------------------------------------------------------------

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
    // Cancel pending remote requests
    this.abortController.abort()

    await this.releaseResources()

    logger.debug(`Cleaned muxing for video ${this.video.url}`, { inputs: this.inputsToLog() })
  }

  // Can be called multiple times
  private async releaseResources () {
    for (const destination of this.tmpDestinations.splice(0)) {
      await remove(destination)
        .catch(err => logger.error('Cannot remove tmp destination', { err, destination }))
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
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function throwIfRecentRemoteHostFailure (url: string) {
  const host = getURLHost(url)
  if (!host) return

  const message = remoteHostFailures.get(host)
  if (message === undefined) return

  logger.debug(`Skip request of remote file ${url}: host ${host} recently failed`, { message })

  throw new Error(`Remote host ${host} recently failed (${message}), try again later`)
}

const REMOTE_HOST_NETWORK_ERROR_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ECONNABORTED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'EHOSTDOWN',
  'ENETUNREACH',
  'EPIPE',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'
])

// Only errors caused by the remote host itself, before it sent a valid response
function isRemoteHostFailure (err: PeerTubeRequestError) {
  const statusCode = err?.statusCode

  if (statusCode) {
    return statusCode >= 500 || statusCode === HttpStatusCode.TOO_MANY_REQUESTS_429
  }

  // No response: network error (that can take time to fail: DNS, connection timeout...)
  const code = err?.code
  if (!code) return false

  return REMOTE_HOST_NETWORK_ERROR_CODES.has(code) ||
    code.startsWith('CERT_') ||
    code.startsWith('ERR_TLS_') ||
    code.startsWith('ERR_SSL_')
}

function getURLHost (url: string) {
  try {
    return new URL(url).host
  } catch {
    return undefined
  }
}
