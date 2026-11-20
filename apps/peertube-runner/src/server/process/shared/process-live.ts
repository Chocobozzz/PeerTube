import {
  compareLiveFilenames,
  getLivePlaylistIdFromSegmentPath,
  getLivePlaylistNameFromSegmentPath,
  isLivePlaylistPath,
  isLiveSegmentPath,
  redactRTMPStreamKeys,
  wait
} from '@peertube/peertube-core-utils'
import {
  ffprobePromise,
  getVideoStreamBitrate,
  getVideoStreamDimensionsInfo,
  hasAudioStream,
  hasVideoStream
} from '@peertube/peertube-ffmpeg'
import {
  LiveRTMPHLSTranscodingSuccess,
  LiveRTMPHLSTranscodingUpdatePayload,
  PeerTubeProblemDocument,
  RunnerJobLiveRTMPHLSTranscodingPayload,
  ServerErrorCode
} from '@peertube/peertube-models'
import { buildUUID, DirectoryWatcher } from '@peertube/peertube-node-utils'
import { FfmpegCommand } from 'fluent-ffmpeg'
import { ensureDir, remove } from 'fs-extra/esm'
import { readFile } from 'fs/promises'
import { basename, join } from 'path'
import { ConfigManager } from '../../../shared/config-manager.js'
import { logger } from '../../../shared/index.js'
import { buildFFmpegLive, ProcessOptions } from './common.js'

type CustomLiveRTMPHLSTranscodingUpdatePayload = Omit<LiveRTMPHLSTranscodingUpdatePayload, 'resolutionPlaylistFile'> & {
  resolutionPlaylistFile?: [Buffer, string] | Blob | string
}

export class ProcessLiveRTMPHLSTranscoding {
  private readonly outputPath: string
  private fsWatcher: DirectoryWatcher

  // Playlist ID -> chunks
  private readonly pendingChunksPerPlaylist = new Map<string, string[]>()

  // Closing the files watcher stops new events but not the async handlers it already started, that can still read
  // the chunks and the playlists of the output directory: the cleanup waits for them
  private readonly pendingWatcherHandlers = new Set<Promise<void>>()

  private readonly playlistsCreated = new Set<string>()
  private allPlaylistsCreated = false

  private latestFilteredPlaylistContent: { [name: string]: string } = {}

  private ffmpegCommand: FfmpegCommand

  private ended = false
  private errored = false

  constructor (private readonly options: ProcessOptions<RunnerJobLiveRTMPHLSTranscodingPayload>) {
    this.outputPath = join(ConfigManager.Instance.getTranscodingDirectory(), buildUUID())

    logger.debug(`Using ${this.outputPath} to process live rtmp hls transcoding job ${options.job.uuid}`)
  }

  private get payload () {
    return this.options.job.payload
  }

  process () {
    return new Promise<void>(async (res, rej) => {
      try {
        await ensureDir(this.outputPath)

        logger.info(`Probing ${redactRTMPStreamKeys(this.payload.input.rtmpUrl)}`)
        const probe = await ffprobePromise(this.payload.input.rtmpUrl)
        logger.info(
          { probe: { ...probe, format: { ...probe.format, filename: redactRTMPStreamKeys(probe.format?.filename) } } },
          `Probed ${redactRTMPStreamKeys(this.payload.input.rtmpUrl)}`
        )

        const hasAudio = await hasAudioStream(this.payload.input.rtmpUrl, probe)
        const hasVideo = await hasVideoStream(this.payload.input.rtmpUrl, probe)
        const bitrate = await getVideoStreamBitrate(this.payload.input.rtmpUrl, probe)
        const { ratio } = await getVideoStreamDimensionsInfo(this.payload.input.rtmpUrl, probe)

        const onPlaylistAdded = (p: string) => {
          this.playlistsCreated.add(p)

          if (this.playlistsCreated.size === this.options.job.payload.output.toTranscode.length + 1) {
            this.allPlaylistsCreated = true
            logger.info('All m3u8 playlists are created.')
          }
        }

        const onChunkAdded = async (p: string) => {
          try {
            await this.sendPendingChunks()
          } catch (err) {
            this.onUpdateError({ err, rej, res })
          }

          const playlistId = getLivePlaylistIdFromSegmentPath(p)
          if (!playlistId) {
            logger.warn(`Cannot get the playlist id of live chunk ${p}, ignoring it`)
            return
          }

          const pendingChunks = this.pendingChunksPerPlaylist.get(playlistId) || []
          pendingChunks.push(p)

          this.pendingChunksPerPlaylist.set(playlistId, pendingChunks)
        }

        this.fsWatcher = new DirectoryWatcher({
          directory: this.outputPath,
          filter: filename => isLiveSegmentPath(filename) || isLivePlaylistPath(filename),
          // A listing has to rebuild the order in which ffmpeg generated the files
          sort: compareLiveFilenames
        })

        this.fsWatcher.on('error', err => logger.error({ err }, `Error in watcher of ${this.outputPath}`))

        this.fsWatcher.on('add', p => {
          if (isLivePlaylistPath(p)) return onPlaylistAdded(p)

          this.trackWatcherHandler(
            onChunkAdded(p)
              .catch(err => logger.error({ err }, `Error in add handler of ${p}`))
          )
        })

        this.fsWatcher.on('unlink', p => {
          if (!isLiveSegmentPath(p)) return

          this.trackWatcherHandler(
            this.sendDeletedChunkUpdate(p)
              .catch(err => this.onUpdateError({ err, rej, res }))
          )
        })

        this.fsWatcher.watch()

        this.ffmpegCommand = await buildFFmpegLive().getLiveTranscodingCommand({
          inputUrl: this.payload.input.rtmpUrl,

          outPath: this.outputPath,
          masterPlaylistName: 'master.m3u8',

          segmentListSize: this.payload.output.segmentListSize,
          segmentDuration: this.payload.output.segmentDuration,

          toTranscode: this.payload.output.toTranscode,
          splitAudioAndVideo: true,

          bitrate,
          ratio,

          hasAudio,
          hasVideo,
          probe
        })

        logger.info(`Running live transcoding for ${redactRTMPStreamKeys(this.payload.input.rtmpUrl)}`)

        this.ffmpegCommand.on('error', (err, stdout, stderr) => {
          this.onFFmpegError({ err, stdout, stderr })

          res()
        })

        this.ffmpegCommand.on('end', () => {
          this.onFFmpegEnded()
            .catch(err => logger.error({ err }, 'Error in FFmpeg end handler'))

          res()
        })

        this.ffmpegCommand.run()
      } catch (err) {
        rej(err)
      }
    })
  }

  // ---------------------------------------------------------------------------

  private onUpdateError (options: {
    err: Error
    res: () => void
    rej: (reason?: any) => void
  }) {
    const { err, res, rej } = options

    if (this.errored) return
    if (this.ended) return

    this.errored = true

    this.ffmpegCommand.kill('SIGINT')

    const type = ((err as any).res?.body as PeerTubeProblemDocument)?.code
    if (type === ServerErrorCode.RUNNER_JOB_NOT_IN_PROCESSING_STATE) {
      logger.info('Stopping transcoding as the job is not in processing state anymore')

      this.sendSuccess()
        .catch(err => logger.error({ err }, 'Cannot send success'))

      res()
    } else {
      logger.error({ err }, 'Cannot send update after added/deleted chunk, stopping live transcoding')

      this.sendError(err)
        .catch(subErr => logger.error({ err: subErr }, 'Cannot send error'))

      rej(err)
    }

    this.cleanup()
  }

  // ---------------------------------------------------------------------------

  private onFFmpegError (options: {
    err: any
    stdout: string
    stderr: string
  }) {
    const { err, stdout, stderr } = options

    // Don't care that we killed the ffmpeg process
    if (err?.message?.includes('Exiting normally')) return
    if (this.errored) return
    if (this.ended) return

    this.errored = true

    // The RTMP input URL contains the stream key
    if (typeof err?.message === 'string') err.message = redactRTMPStreamKeys(err.message)

    logger.error({ err, stdout: redactRTMPStreamKeys(stdout), stderr: redactRTMPStreamKeys(stderr) }, 'FFmpeg transcoding error.')

    this.sendError(err)
      .catch(subErr => logger.error({ err: subErr }, 'Cannot send error'))

    this.cleanup()
  }

  private async sendError (err: Error) {
    await this.options.server.runnerJobs.error({
      jobToken: this.options.job.jobToken,
      jobUUID: this.options.job.uuid,
      runnerToken: this.options.runnerToken,
      message: err.message
    })
  }

  // ---------------------------------------------------------------------------

  private async onFFmpegEnded () {
    if (this.ended) return

    logger.info('FFmpeg ended, sending success to server')

    // Wait last ffmpeg chunks generation
    await wait(1500)

    try {
      // ffmpeg exited so no new chunk will be generated, but the OS watcher may never have notified us of the last
      // ones: ask for a final listing, and wait for the handlers that queue them
      await this.fsWatcher?.flush()
      await Promise.all(this.pendingWatcherHandlers)

      await this.sendPendingChunks()
    } catch (err) {
      logger.error(err, 'Cannot send latest chunks after ffmpeg ended')
    }

    this.ended = true

    this.sendSuccess()
      .catch(err => logger.error({ err }, 'Cannot send success'))

    this.cleanup()
  }

  private async sendSuccess () {
    const successBody: LiveRTMPHLSTranscodingSuccess = {}

    await this.options.server.runnerJobs.success({
      jobToken: this.options.job.jobToken,
      jobUUID: this.options.job.uuid,
      runnerToken: this.options.runnerToken,
      payload: successBody,
      reqPayload: this.payload
    })
  }

  // ---------------------------------------------------------------------------

  private async sendDeletedChunkUpdate (deletedChunk: string): Promise<any> {
    if (this.ended) return

    logger.debug(`Sending removed live chunk ${deletedChunk} update`)

    const videoChunkFilename = basename(deletedChunk)

    let payload: CustomLiveRTMPHLSTranscodingUpdatePayload = {
      type: 'remove-chunk',
      videoChunkFilename
    }

    const playlistName = getLivePlaylistNameFromSegmentPath(videoChunkFilename)

    // We may never have been able to read the content of the playlist that references this chunk
    if (this.allPlaylistsCreated && this.latestFilteredPlaylistContent[playlistName]) {
      payload = {
        ...payload,

        masterPlaylistFile: join(this.outputPath, 'master.m3u8'),
        resolutionPlaylistFilename: playlistName,
        resolutionPlaylistFile: this.buildPlaylistFileParam(playlistName)
      }
    }

    return this.updateWithRetry(payload)
  }

  private async sendPendingChunks (): Promise<any> {
    if (this.ended) return Promise.resolve()

    const parallelPromises: Promise<any>[] = []

    for (const playlist of this.pendingChunksPerPlaylist.keys()) {
      let sequentialPromises: Promise<any>

      for (const chunk of this.pendingChunksPerPlaylist.get(playlist)) {
        logger.debug(`Sending added live chunk ${chunk} update`)

        const videoChunkFilename = basename(chunk)

        const payloadBuilder = async () => {
          let payload: CustomLiveRTMPHLSTranscodingUpdatePayload = {
            type: 'add-chunk',
            videoChunkFilename,
            videoChunkFile: chunk
          }

          const playlistName = getLivePlaylistNameFromSegmentPath(videoChunkFilename)

          if (this.allPlaylistsCreated && playlistName) {
            try {
              await this.updatePlaylistContent(playlistName, videoChunkFilename)

              payload = {
                ...payload,

                masterPlaylistFile: join(this.outputPath, 'master.m3u8'),
                resolutionPlaylistFilename: playlistName,
                resolutionPlaylistFile: this.buildPlaylistFileParam(playlistName)
              }
            } catch (err) {
              logger.warn(err, `Cannot fetch/update playlist content ${playlistName}`)
            }
          }

          return payload
        }

        const p = payloadBuilder().then(p => this.updateWithRetry(p))

        if (sequentialPromises === undefined) sequentialPromises = p
        else sequentialPromises = sequentialPromises.then(() => p)
      }

      parallelPromises.push(sequentialPromises)
      this.pendingChunksPerPlaylist.set(playlist, [])
    }

    await Promise.all(parallelPromises)
  }

  private async updateWithRetry (updatePayload: CustomLiveRTMPHLSTranscodingUpdatePayload, currentTry = 1): Promise<any> {
    if (this.ended || this.errored) return

    try {
      await this.options.server.runnerJobs.update({
        jobToken: this.options.job.jobToken,
        jobUUID: this.options.job.uuid,
        runnerToken: this.options.runnerToken,
        payload: updatePayload as any,
        reqPayload: this.payload
      })
    } catch (err) {
      if (currentTry >= 3) throw err
      if ((err.res?.body as PeerTubeProblemDocument)?.code === ServerErrorCode.RUNNER_JOB_NOT_IN_PROCESSING_STATE) throw err

      logger.warn({ err }, 'Will retry update after error')
      await wait(250)

      return this.updateWithRetry(updatePayload, currentTry + 1)
    }
  }

  private async updatePlaylistContent (playlistName: string, latestChunkFilename: string) {
    const m3u8Path = join(this.outputPath, playlistName)
    let playlistContent = await readFile(m3u8Path, 'utf-8')

    if (!playlistContent.includes('#EXT-X-ENDLIST')) {
      playlistContent = playlistContent.substring(
        0,
        playlistContent.lastIndexOf(latestChunkFilename) + latestChunkFilename.length
      ) + '\n'
    }

    // Remove new chunk references, that will be processed later
    this.latestFilteredPlaylistContent[playlistName] = playlistContent
  }

  private buildPlaylistFileParam (playlistName: string) {
    return [
      Buffer.from(this.latestFilteredPlaylistContent[playlistName], 'utf-8'),
      join(this.outputPath, 'master.m3u8')
    ] as [Buffer, string]
  }

  // ---------------------------------------------------------------------------

  private cleanup () {
    logger.debug(`Cleaning up job ${this.options.job.uuid}`)

    this.removeOutputDirectory()
      .catch(err => logger.error({ err }, `Cannot remove ${this.outputPath}`))
  }

  private async removeOutputDirectory () {
    // Wait for the watcher to stop reading the directory before removing it
    await this.fsWatcher?.close()

    await Promise.all(this.pendingWatcherHandlers)

    await remove(this.outputPath)
  }

  // Watcher handlers are async and fire and forget: remember them so the cleanup can wait for the pending ones
  private trackWatcherHandler (handler: Promise<void>) {
    const tracked: Promise<void> = handler
      .catch(err => logger.error({ err }, 'Error in live files watcher handler'))
      .finally(() => {
        this.pendingWatcherHandlers.delete(tracked)
      })

    this.pendingWatcherHandlers.add(tracked)
  }
}
