
import * as Bluebird from 'bluebird'
import * as chokidar from 'chokidar'
import { FfmpegCommand } from 'fluent-ffmpeg'
import { appendFile, ensureDir, readFile, stat } from 'fs-extra'
import { basename, join } from 'path'
import { EventEmitter } from 'stream'
import { getLiveMuxingCommand, getLiveTranscodingCommand } from '@server/helpers/ffmpeg-utils'
import { logger, loggerTagsFactory, LoggerTagsFn } from '@server/helpers/logger'
import { CONFIG } from '@server/initializers/config'
import { MEMOIZE_TTL, VIDEO_LIVE } from '@server/initializers/constants'
import { VideoFileModel } from '@server/models/video/video-file'
import { MStreamingPlaylistVideo, MUserId, MVideoLiveVideo } from '@server/types/models'
import { VideoTranscodingProfilesManager } from '../../transcoding/video-transcoding-profiles'
import { isAbleToUploadVideo } from '../../user'
import { getHLSDirectory } from '../../video-paths'
import { LiveQuotaStore } from '../live-quota-store'
import { LiveSegmentShaStore } from '../live-segment-sha-store'
import { buildConcatenatedName } from '../live-utils'

import memoizee = require('memoizee')

interface MuxingSessionEvents {
  'master-playlist-created': ({ videoId: number }) => void

  'bad-socket-health': ({ videoId: number }) => void
  'duration-exceeded': ({ videoId: number }) => void
  'quota-exceeded': ({ videoId: number }) => void

  'ffmpeg-end': ({ videoId: number }) => void
  'ffmpeg-error': ({ sessionId: string }) => void

  'after-cleanup': ({ videoId: number }) => void
}

declare interface MuxingSession {
  on<U extends keyof MuxingSessionEvents>(
    event: U, listener: MuxingSessionEvents[U]
  ): this

  emit<U extends keyof MuxingSessionEvents>(
    event: U, ...args: Parameters<MuxingSessionEvents[U]>
  ): boolean
}

class MuxingSession extends EventEmitter {

  private ffmpegCommand: FfmpegCommand

  private readonly context: any
  private readonly user: MUserId
  private readonly sessionId: string
  private readonly videoLive: MVideoLiveVideo
  private readonly streamingPlaylist: MStreamingPlaylistVideo
  private readonly rtmpUrl: string
  private readonly fps: number
  private readonly allResolutions: number[]

  private readonly videoId: number
  private readonly videoUUID: string
  private readonly saveReplay: boolean

  private readonly lTags: LoggerTagsFn

  private segmentsToProcessPerPlaylist: { [playlistId: string]: string[] } = {}

  private tsWatcher: chokidar.FSWatcher
  private masterWatcher: chokidar.FSWatcher

  private readonly isAbleToUploadVideoWithCache = memoizee((userId: number) => {
    return isAbleToUploadVideo(userId, 1000)
  }, { maxAge: MEMOIZE_TTL.LIVE_ABLE_TO_UPLOAD })

  private readonly hasClientSocketInBadHealthWithCache = memoizee((sessionId: string) => {
    return this.hasClientSocketInBadHealth(sessionId)
  }, { maxAge: MEMOIZE_TTL.LIVE_CHECK_SOCKET_HEALTH })

  constructor (options: {
    context: any
    user: MUserId
    sessionId: string
    videoLive: MVideoLiveVideo
    streamingPlaylist: MStreamingPlaylistVideo
    rtmpUrl: string
    fps: number
    allResolutions: number[]
  }) {
    super()

    this.context = options.context
    this.user = options.user
    this.sessionId = options.sessionId
    this.videoLive = options.videoLive
    this.streamingPlaylist = options.streamingPlaylist
    this.rtmpUrl = options.rtmpUrl
    this.fps = options.fps
    this.allResolutions = options.allResolutions

    this.videoId = this.videoLive.Video.id
    this.videoUUID = this.videoLive.Video.uuid

    this.saveReplay = this.videoLive.saveReplay

    this.lTags = loggerTagsFactory('live', this.sessionId, this.videoUUID)
  }

  async runMuxing () {
    this.createFiles()

    const outPath = await this.prepareDirectories()

    this.ffmpegCommand = CONFIG.LIVE.TRANSCODING.ENABLED
      ? await getLiveTranscodingCommand({
        rtmpUrl: this.rtmpUrl,
        outPath,
        resolutions: this.allResolutions,
        fps: this.fps,
        availableEncoders: VideoTranscodingProfilesManager.Instance.getAvailableEncoders(),
        profile: CONFIG.LIVE.TRANSCODING.PROFILE
      })
      : getLiveMuxingCommand(this.rtmpUrl, outPath)

    logger.info('Running live muxing/transcoding for %s.', this.videoUUID, this.lTags)

    this.watchTSFiles(outPath)
    this.watchMasterFile(outPath)

    this.ffmpegCommand.on('error', (err, stdout, stderr) => {
      this.onFFmpegError(err, stdout, stderr, outPath)
    })

    this.ffmpegCommand.on('end', () => this.onFFmpegEnded(outPath))

    this.ffmpegCommand.run()
  }

  abort () {
    if (!this.ffmpegCommand) return

    this.ffmpegCommand.kill('SIGINT')
  }

  destroy () {
    this.removeAllListeners()
    this.isAbleToUploadVideoWithCache.clear()
    this.hasClientSocketInBadHealthWithCache.clear()
  }

  private onFFmpegError (err: any, stdout: string, stderr: string, outPath: string) {
    this.onFFmpegEnded(outPath)

    // Don't care that we killed the ffmpeg process
    if (err?.message?.includes('Exiting normally')) return

    logger.error('Live transcoding error.', { err, stdout, stderr, ...this.lTags })

    this.emit('ffmpeg-error', ({ sessionId: this.sessionId }))
  }

  private onFFmpegEnded (outPath: string) {
    logger.info('RTMP transmuxing for video %s ended. Scheduling cleanup', this.rtmpUrl, this.lTags)

    setTimeout(() => {
      // Wait latest segments generation, and close watchers

      Promise.all([ this.tsWatcher.close(), this.masterWatcher.close() ])
        .then(() => {
          // Process remaining segments hash
          for (const key of Object.keys(this.segmentsToProcessPerPlaylist)) {
            this.processSegments(outPath, this.segmentsToProcessPerPlaylist[key])
          }
        })
        .catch(err => {
          logger.error(
            'Cannot close watchers of %s or process remaining hash segments.', outPath,
            { err, ...this.lTags }
          )
        })

      this.emit('after-cleanup', { videoId: this.videoId })
    }, 1000)
  }

  private watchMasterFile (outPath: string) {
    this.masterWatcher = chokidar.watch(outPath + '/master.m3u8')

    this.masterWatcher.on('add', async () => {
      this.emit('master-playlist-created', { videoId: this.videoId })

      this.masterWatcher.close()
        .catch(err => logger.error('Cannot close master watcher of %s.', outPath, { err, ...this.lTags }))
    })
  }

  private watchTSFiles (outPath: string) {
    const startStreamDateTime = new Date().getTime()

    this.tsWatcher = chokidar.watch(outPath + '/*.ts')

    const playlistIdMatcher = /^([\d+])-/

    const addHandler = async segmentPath => {
      logger.debug('Live add handler of %s.', segmentPath, this.lTags)

      const playlistId = basename(segmentPath).match(playlistIdMatcher)[0]

      const segmentsToProcess = this.segmentsToProcessPerPlaylist[playlistId] || []
      this.processSegments(outPath, segmentsToProcess)

      this.segmentsToProcessPerPlaylist[playlistId] = [ segmentPath ]

      if (this.hasClientSocketInBadHealthWithCache(this.sessionId)) {
        this.emit('bad-socket-health', { videoId: this.videoId })
        return
      }

      // Duration constraint check
      if (this.isDurationConstraintValid(startStreamDateTime) !== true) {
        this.emit('duration-exceeded', { videoId: this.videoId })
        return
      }

      // Check user quota if the user enabled replay saving
      if (await this.isQuotaExceeded(segmentPath) === true) {
        this.emit('quota-exceeded', { videoId: this.videoId })
      }
    }

    const deleteHandler = segmentPath => LiveSegmentShaStore.Instance.removeSegmentSha(this.videoUUID, segmentPath)

    this.tsWatcher.on('add', p => addHandler(p))
    this.tsWatcher.on('unlink', p => deleteHandler(p))
  }

  private async isQuotaExceeded (segmentPath: string) {
    if (this.saveReplay !== true) return false

    try {
      const segmentStat = await stat(segmentPath)

      LiveQuotaStore.Instance.addQuotaTo(this.user.id, this.videoLive.id, segmentStat.size)

      const canUpload = await this.isAbleToUploadVideoWithCache(this.user.id)

      return canUpload !== true
    } catch (err) {
      logger.error('Cannot stat %s or check quota of %d.', segmentPath, this.user.id, { err, ...this.lTags })
    }
  }

  private createFiles () {
    for (let i = 0; i < this.allResolutions.length; i++) {
      const resolution = this.allResolutions[i]

      const file = new VideoFileModel({
        resolution,
        size: -1,
        extname: '.ts',
        infoHash: null,
        fps: this.fps,
        videoStreamingPlaylistId: this.streamingPlaylist.id
      })

      VideoFileModel.customUpsert(file, 'streaming-playlist', null)
        .catch(err => logger.error('Cannot create file for live streaming.', { err, ...this.lTags }))
    }
  }

  private async prepareDirectories () {
    const outPath = getHLSDirectory(this.videoLive.Video)
    await ensureDir(outPath)

    const replayDirectory = join(outPath, VIDEO_LIVE.REPLAY_DIRECTORY)

    if (this.videoLive.saveReplay === true) {
      await ensureDir(replayDirectory)
    }

    return outPath
  }

  private isDurationConstraintValid (streamingStartTime: number) {
    const maxDuration = CONFIG.LIVE.MAX_DURATION
    // No limit
    if (maxDuration < 0) return true

    const now = new Date().getTime()
    const max = streamingStartTime + maxDuration

    return now <= max
  }

  private processSegments (hlsVideoPath: string, segmentPaths: string[]) {
    Bluebird.mapSeries(segmentPaths, async previousSegment => {
      // Add sha hash of previous segments, because ffmpeg should have finished generating them
      await LiveSegmentShaStore.Instance.addSegmentSha(this.videoUUID, previousSegment)

      if (this.saveReplay) {
        await this.addSegmentToReplay(hlsVideoPath, previousSegment)
      }
    }).catch(err => logger.error('Cannot process segments in %s', hlsVideoPath, { err, ...this.lTags }))
  }

  private hasClientSocketInBadHealth (sessionId: string) {
    const rtmpSession = this.context.sessions.get(sessionId)

    if (!rtmpSession) {
      logger.warn('Cannot get session %s to check players socket health.', sessionId, this.lTags)
      return
    }

    for (const playerSessionId of rtmpSession.players) {
      const playerSession = this.context.sessions.get(playerSessionId)

      if (!playerSession) {
        logger.error('Cannot get player session %s to check socket health.', playerSession, this.lTags)
        continue
      }

      if (playerSession.socket.writableLength > VIDEO_LIVE.MAX_SOCKET_WAITING_DATA) {
        return true
      }
    }

    return false
  }

  private async addSegmentToReplay (hlsVideoPath: string, segmentPath: string) {
    const segmentName = basename(segmentPath)
    const dest = join(hlsVideoPath, VIDEO_LIVE.REPLAY_DIRECTORY, buildConcatenatedName(segmentName))

    try {
      const data = await readFile(segmentPath)

      await appendFile(dest, data)
    } catch (err) {
      logger.error('Cannot copy segment %s to replay directory.', segmentPath, { err, ...this.lTags })
    }
  }
}

// ---------------------------------------------------------------------------

export {
  MuxingSession
}
