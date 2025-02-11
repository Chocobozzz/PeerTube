import { wait } from '@peertube/peertube-core-utils'
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
import { buildUUID } from '@peertube/peertube-node-utils'
import { FSWatcher, watch } from 'chokidar'
import { FfmpegCommand } from 'fluent-ffmpeg'
import { ensureDir, remove } from 'fs-extra/esm'
import { readFile } from 'fs/promises'
import { basename, join } from 'path'
import { ConfigManager } from '../../../shared/config-manager.js'
import { logger } from '../../../shared/index.js'
import { buildFFmpegLive, ProcessOptions } from './common.js'

type CustomLiveRTMPHLSTranscodingUpdatePayload =
  Omit<LiveRTMPHLSTranscodingUpdatePayload, 'resolutionPlaylistFile'> & { resolutionPlaylistFile?: [ Buffer, string ] | Blob | string }

export class ProcessLiveRTMPHLSTranscoding {

  private readonly outputPath: string
  private readonly fsWatchers: FSWatcher[] = []

  // Playlist name -> chunks
  private readonly pendingChunksPerPlaylist = new Map<string, string[]>()

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

        logger.info(`Probing ${this.payload.input.rtmpUrl}`)
        const probe = await ffprobePromise(this.payload.input.rtmpUrl)
        logger.info({ probe }, `Probed ${this.payload.input.rtmpUrl}`)

        const hasAudio = await hasAudioStream(this.payload.input.rtmpUrl, probe)
        const hasVideo = await hasVideoStream(this.payload.input.rtmpUrl, probe)
        const bitrate = await getVideoStreamBitrate(this.payload.input.rtmpUrl, probe)
        const { ratio } = await getVideoStreamDimensionsInfo(this.payload.input.rtmpUrl, probe)

        const m3u8Watcher = watch(this.outputPath, { ignored: path => path !== this.outputPath && !path.endsWith('.m3u8') })
        this.fsWatchers.push(m3u8Watcher)

        const tsWatcher = watch(this.outputPath, { ignored: path => path !== this.outputPath && !path.endsWith('.ts') })
        this.fsWatchers.push(tsWatcher)

        m3u8Watcher.on('change', p => {
          logger.debug(`${p} m3u8 playlist changed`)
        })

        m3u8Watcher.on('add', p => {
          this.playlistsCreated.add(p)

          if (this.playlistsCreated.size === this.options.job.payload.output.toTranscode.length + 1) {
            this.allPlaylistsCreated = true
            logger.info('All m3u8 playlists are created.')
          }
        })

        tsWatcher.on('add', async p => {
          try {
            await this.sendPendingChunks()
          } catch (err) {
            this.onUpdateError({ err, rej, res })
          }

          const playlistName = this.getPlaylistIdFromTS(p)

          const pendingChunks = this.pendingChunksPerPlaylist.get(playlistName) || []
          pendingChunks.push(p)

          this.pendingChunksPerPlaylist.set(playlistName, pendingChunks)
        })

        tsWatcher.on('unlink', p => {
          this.sendDeletedChunkUpdate(p)
            .catch(err => this.onUpdateError({ err, rej, res }))
        })

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

        logger.info(`Running live transcoding for ${this.payload.input.rtmpUrl}`)

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

    logger.error({ err, stdout, stderr }, 'FFmpeg transcoding error.')

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
    await this.sendPendingChunks()

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

  private sendDeletedChunkUpdate (deletedChunk: string): Promise<any> {
    if (this.ended) return Promise.resolve()

    logger.debug(`Sending removed live chunk ${deletedChunk} update`)

    const videoChunkFilename = basename(deletedChunk)

    let payload: CustomLiveRTMPHLSTranscodingUpdatePayload = {
      type: 'remove-chunk',
      videoChunkFilename
    }

    if (this.allPlaylistsCreated) {
      const playlistName = this.getPlaylistName(videoChunkFilename)

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

          if (this.allPlaylistsCreated) {
            const playlistName = this.getPlaylistName(videoChunkFilename)

            await this.updatePlaylistContent(playlistName, videoChunkFilename)

            payload = {
              ...payload,

              masterPlaylistFile: join(this.outputPath, 'master.m3u8'),
              resolutionPlaylistFilename: playlistName,
              resolutionPlaylistFile: this.buildPlaylistFileParam(playlistName)
            }
          }

          return payload
        }

        const p = payloadBuilder().then(p => this.updateWithRetry(p))

        if (!sequentialPromises) sequentialPromises = p
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

  private getPlaylistName (videoChunkFilename: string) {
    return `${videoChunkFilename.split('-')[0]}.m3u8`
  }

  private getPlaylistIdFromTS (segmentPath: string) {
    const playlistIdMatcher = /^([\d+])-/

    return basename(segmentPath).match(playlistIdMatcher)[1]
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
    ] as [ Buffer, string ]
  }

  // ---------------------------------------------------------------------------

  private cleanup () {
    logger.debug(`Cleaning up job ${this.options.job.uuid}`)

    for (const fsWatcher of this.fsWatchers) {
      fsWatcher.close()
        .catch(err => logger.error({ err }, 'Cannot close watcher'))
    }

    remove(this.outputPath)
      .catch(err => logger.error({ err }, `Cannot remove ${this.outputPath}`))
  }
}
