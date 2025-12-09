import { FFmpegContainer } from '@peertube/peertube-ffmpeg'
import { FileStorage } from '@peertube/peertube-models'
import { getFFmpegCommandWrapperOptions } from '@server/helpers/ffmpeg/ffmpeg-options.js'
import { logger } from '@server/helpers/logger.js'
import { buildRequestError, doRequestAndSaveToFile, generateRequestStream } from '@server/helpers/requests.js'
import { REQUEST_TIMEOUTS } from '@server/initializers/constants.js'
import { MVideoFile, MVideoThumbnail } from '@server/types/models/index.js'
import { remove } from 'fs-extra/esm'
import { Readable, Writable } from 'stream'
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

  private readonly video: MVideoThumbnail
  private readonly videoFiles: MVideoFile[]

  constructor (options: {
    video: MVideoThumbnail
    videoFiles: MVideoFile[]
  }) {
    this.video = options.video
    this.videoFiles = options.videoFiles
  }

  async muxToMergeVideoFiles (output: Writable) {
    return new Promise<void>(async (res, rej) => {
      try {
        VideoDownload.totalDownloads++

        const maxResolution = await this.buildMuxInputs(rej)

        // Include cover to audio file?
        const { coverPath, isTmpDestination } = maxResolution === 0
          ? await this.buildCoverInput()
          : { coverPath: undefined, isTmpDestination: false }

        if (coverPath && isTmpDestination) {
          this.tmpDestinations.push(coverPath)
        }

        logger.info(`Muxing files for video ${this.video.url}`, { inputs: this.inputsToLog(), ...lTags(this.video.uuid) })

        this.ffmpegContainer = new FFmpegContainer(getFFmpegCommandWrapperOptions('vod'))

        try {
          await this.ffmpegContainer.mergeInputs({
            inputs: this.inputs,
            output,
            logError: false,

            // Include a cover if this is an audio file
            coverPath
          })

          logger.info(`Mux ended for video ${this.video.url}`, { inputs: this.inputsToLog(), ...lTags(this.video.uuid) })

          res()
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
          this.ffmpegContainer.forceKill()
        }
      } catch (err) {
        rej(err)
      } finally {
        this.cleanup()
          .catch(cleanupErr => logger.error('Cannot cleanup after mux error', { err: cleanupErr, ...lTags(this.video.uuid) }))
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

          this.cleanup()
            .catch(cleanupErr => logger.error('Cannot cleanup after mux error', { err: cleanupErr, ...lTags(this.video.uuid) }))

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
        await makeHLSFileAvailable(this.video.getHLSPlaylist(), videoFile.filename, destination)
      } else {
        await makeWebVideoFileAvailable(videoFile.filename, destination)
      }

      return { input: destination, isTmpDestination: true as const }
    }

    if (videoFile.isHLS()) {
      const { stream } = await getHLSFileReadStream({
        playlist: this.video.getHLSPlaylist().withVideo(this.video),
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
    const preview = this.video.getPreview()

    if (this.video.isLocal()) return { coverPath: preview?.getPath() }

    if (preview.fileUrl) {
      const destination = VideoPathManager.Instance.buildTMPDestination(preview.filename)

      await doRequestAndSaveToFile(preview.fileUrl, destination)

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
