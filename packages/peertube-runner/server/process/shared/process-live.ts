import { FSWatcher, watch } from 'chokidar'
import { FfmpegCommand } from 'fluent-ffmpeg'
import { ensureDir, remove } from 'fs-extra'
import { logger } from 'packages/peertube-runner/shared'
import { basename, join } from 'path'
import { wait } from '@shared/core-utils'
import { buildUUID } from '@shared/extra-utils'
import { ffprobePromise, getVideoStreamBitrate, getVideoStreamDimensionsInfo, hasAudioStream } from '@shared/ffmpeg'
import {
  LiveRTMPHLSTranscodingSuccess,
  LiveRTMPHLSTranscodingUpdatePayload,
  PeerTubeProblemDocument,
  RunnerJobLiveRTMPHLSTranscodingPayload,
  ServerErrorCode
} from '@shared/models'
import { ConfigManager } from '../../../shared/config-manager'
import { buildFFmpegLive, ProcessOptions } from './common'

export class ProcessLiveRTMPHLSTranscoding {

  private readonly outputPath: string
  private readonly fsWatchers: FSWatcher[] = []

  private readonly playlistsCreated = new Set<string>()
  private allPlaylistsCreated = false

  private ffmpegCommand: FfmpegCommand

  private ended = false
  private errored = false

  constructor (private readonly options: ProcessOptions<RunnerJobLiveRTMPHLSTranscodingPayload>) {
    this.outputPath = join(ConfigManager.Instance.getTranscodingDirectory(), buildUUID())
  }

  process () {
    const job = this.options.job
    const payload = job.payload

    return new Promise<void>(async (res, rej) => {
      try {
        await ensureDir(this.outputPath)

        logger.info(`Probing ${payload.input.rtmpUrl}`)
        const probe = await ffprobePromise(payload.input.rtmpUrl)
        logger.info({ probe }, `Probed ${payload.input.rtmpUrl}`)

        const hasAudio = await hasAudioStream(payload.input.rtmpUrl, probe)
        const bitrate = await getVideoStreamBitrate(payload.input.rtmpUrl, probe)
        const { ratio } = await getVideoStreamDimensionsInfo(payload.input.rtmpUrl, probe)

        const m3u8Watcher = watch(this.outputPath + '/*.m3u8')
        this.fsWatchers.push(m3u8Watcher)

        const tsWatcher = watch(this.outputPath + '/*.ts')
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

        tsWatcher.on('add', p => {
          this.sendAddedChunkUpdate(p)
            .catch(err => this.onUpdateError(err, rej))
        })

        tsWatcher.on('unlink', p => {
          this.sendDeletedChunkUpdate(p)
            .catch(err => this.onUpdateError(err, rej))
        })

        this.ffmpegCommand = await buildFFmpegLive().getLiveTranscodingCommand({
          inputUrl: payload.input.rtmpUrl,

          outPath: this.outputPath,
          masterPlaylistName: 'master.m3u8',

          segmentListSize: payload.output.segmentListSize,
          segmentDuration: payload.output.segmentDuration,

          toTranscode: payload.output.toTranscode,

          bitrate,
          ratio,

          hasAudio
        })

        logger.info(`Running live transcoding for ${payload.input.rtmpUrl}`)

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

  private onUpdateError (err: Error, reject: (reason?: any) => void) {
    if (this.errored) return
    if (this.ended) return

    this.errored = true

    reject(err)
    this.ffmpegCommand.kill('SIGINT')

    const type = ((err as any).res?.body as PeerTubeProblemDocument)?.code
    if (type === ServerErrorCode.RUNNER_JOB_NOT_IN_PROCESSING_STATE) {
      logger.info({ err }, 'Stopping transcoding as the job is not in processing state anymore')
    } else {
      logger.error({ err }, 'Cannot send update after added/deleted chunk, stopping live transcoding')

      this.sendError(err)
        .catch(subErr => logger.error({ err: subErr }, 'Cannot send error'))
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

    this.ended = true
    logger.info('FFmpeg ended, sending success to server')

    // Wait last ffmpeg chunks generation
    await wait(1500)

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
      payload: successBody
    })
  }

  // ---------------------------------------------------------------------------

  private sendDeletedChunkUpdate (deletedChunk: string): Promise<any> {
    if (this.ended) return Promise.resolve()

    logger.debug(`Sending removed live chunk ${deletedChunk} update`)

    const videoChunkFilename = basename(deletedChunk)

    let payload: LiveRTMPHLSTranscodingUpdatePayload = {
      type: 'remove-chunk',
      videoChunkFilename
    }

    if (this.allPlaylistsCreated) {
      const playlistName = this.getPlaylistName(videoChunkFilename)

      payload = {
        ...payload,
        masterPlaylistFile: join(this.outputPath, 'master.m3u8'),
        resolutionPlaylistFilename: playlistName,
        resolutionPlaylistFile: join(this.outputPath, playlistName)
      }
    }

    return this.updateWithRetry(payload)
  }

  private sendAddedChunkUpdate (addedChunk: string): Promise<any> {
    if (this.ended) return Promise.resolve()

    logger.debug(`Sending added live chunk ${addedChunk} update`)

    const videoChunkFilename = basename(addedChunk)

    let payload: LiveRTMPHLSTranscodingUpdatePayload = {
      type: 'add-chunk',
      videoChunkFilename,
      videoChunkFile: addedChunk
    }

    if (this.allPlaylistsCreated) {
      const playlistName = this.getPlaylistName(videoChunkFilename)

      payload = {
        ...payload,
        masterPlaylistFile: join(this.outputPath, 'master.m3u8'),
        resolutionPlaylistFilename: playlistName,
        resolutionPlaylistFile: join(this.outputPath, playlistName)
      }
    }

    return this.updateWithRetry(payload)
  }

  private async updateWithRetry (payload: LiveRTMPHLSTranscodingUpdatePayload, currentTry = 1): Promise<any> {
    if (this.ended || this.errored) return

    try {
      await this.options.server.runnerJobs.update({
        jobToken: this.options.job.jobToken,
        jobUUID: this.options.job.uuid,
        runnerToken: this.options.runnerToken,
        payload
      })
    } catch (err) {
      if (currentTry >= 3) throw err

      logger.warn({ err }, 'Will retry update after error')
      await wait(250)

      return this.updateWithRetry(payload, currentTry + 1)
    }
  }

  private getPlaylistName (videoChunkFilename: string) {
    return `${videoChunkFilename.split('-')[0]}.m3u8`
  }

  // ---------------------------------------------------------------------------

  private cleanup () {
    for (const fsWatcher of this.fsWatchers) {
      fsWatcher.close()
        .catch(err => logger.error({ err }, 'Cannot close watcher'))
    }

    remove(this.outputPath)
      .catch(err => logger.error({ err }, `Cannot remove ${this.outputPath}`))
  }
}
