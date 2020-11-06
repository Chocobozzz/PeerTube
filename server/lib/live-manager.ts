
import { AsyncQueue, queue } from 'async'
import * as chokidar from 'chokidar'
import { FfmpegCommand } from 'fluent-ffmpeg'
import { ensureDir, stat } from 'fs-extra'
import { basename } from 'path'
import {
  computeResolutionsToTranscode,
  getVideoFileFPS,
  getVideoFileResolution,
  runLiveMuxing,
  runLiveTranscoding
} from '@server/helpers/ffmpeg-utils'
import { logger } from '@server/helpers/logger'
import { CONFIG, registerConfigChangedHandler } from '@server/initializers/config'
import { MEMOIZE_TTL, P2P_MEDIA_LOADER_PEER_VERSION, VIDEO_LIVE, WEBSERVER } from '@server/initializers/constants'
import { UserModel } from '@server/models/account/user'
import { VideoModel } from '@server/models/video/video'
import { VideoFileModel } from '@server/models/video/video-file'
import { VideoLiveModel } from '@server/models/video/video-live'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist'
import { MStreamingPlaylist, MUserId, MVideoLive, MVideoLiveVideo } from '@server/types/models'
import { VideoState, VideoStreamingPlaylistType } from '@shared/models'
import { federateVideoIfNeeded } from './activitypub/videos'
import { buildSha256Segment } from './hls'
import { JobQueue } from './job-queue'
import { PeerTubeSocket } from './peertube-socket'
import { isAbleToUploadVideo } from './user'
import { getHLSDirectory } from './video-paths'

import memoizee = require('memoizee')
const NodeRtmpServer = require('node-media-server/node_rtmp_server')
const context = require('node-media-server/node_core_ctx')
const nodeMediaServerLogger = require('node-media-server/node_core_logger')

// Disable node media server logs
nodeMediaServerLogger.setLogType(0)

const config = {
  rtmp: {
    port: CONFIG.LIVE.RTMP.PORT,
    chunk_size: VIDEO_LIVE.RTMP.CHUNK_SIZE,
    gop_cache: VIDEO_LIVE.RTMP.GOP_CACHE,
    ping: VIDEO_LIVE.RTMP.PING,
    ping_timeout: VIDEO_LIVE.RTMP.PING_TIMEOUT
  },
  transcoding: {
    ffmpeg: 'ffmpeg'
  }
}

type SegmentSha256QueueParam = {
  operation: 'update' | 'delete'
  videoUUID: string
  segmentPath: string
}

class LiveManager {

  private static instance: LiveManager

  private readonly transSessions = new Map<string, FfmpegCommand>()
  private readonly videoSessions = new Map<number, string>()
  private readonly segmentsSha256 = new Map<string, Map<string, string>>()
  private readonly livesPerUser = new Map<number, { liveId: number, videoId: number, size: number }[]>()

  private readonly isAbleToUploadVideoWithCache = memoizee((userId: number) => {
    return isAbleToUploadVideo(userId, 1000)
  }, { maxAge: MEMOIZE_TTL.LIVE_ABLE_TO_UPLOAD })

  private segmentsSha256Queue: AsyncQueue<SegmentSha256QueueParam>
  private rtmpServer: any

  private constructor () {
  }

  init () {
    const events = this.getContext().nodeEvent
    events.on('postPublish', (sessionId: string, streamPath: string) => {
      logger.debug('RTMP received stream', { id: sessionId, streamPath })

      const splittedPath = streamPath.split('/')
      if (splittedPath.length !== 3 || splittedPath[1] !== VIDEO_LIVE.RTMP.BASE_PATH) {
        logger.warn('Live path is incorrect.', { streamPath })
        return this.abortSession(sessionId)
      }

      this.handleSession(sessionId, streamPath, splittedPath[2])
        .catch(err => logger.error('Cannot handle sessions.', { err }))
    })

    events.on('donePublish', sessionId => {
      logger.info('Live session ended.', { sessionId })
    })

    this.segmentsSha256Queue = queue<SegmentSha256QueueParam, Error>((options, cb) => {
      const promise = options.operation === 'update'
        ? this.addSegmentSha(options)
        : Promise.resolve(this.removeSegmentSha(options))

      promise.then(() => cb())
        .catch(err => {
          logger.error('Cannot update/remove sha segment %s.', options.segmentPath, { err })
          cb()
        })
    })

    registerConfigChangedHandler(() => {
      if (!this.rtmpServer && CONFIG.LIVE.ENABLED === true) {
        this.run()
        return
      }

      if (this.rtmpServer && CONFIG.LIVE.ENABLED === false) {
        this.stop()
      }
    })
  }

  run () {
    logger.info('Running RTMP server on port %d', config.rtmp.port)

    this.rtmpServer = new NodeRtmpServer(config)
    this.rtmpServer.run()
  }

  stop () {
    logger.info('Stopping RTMP server.')

    this.rtmpServer.stop()
    this.rtmpServer = undefined
  }

  getSegmentsSha256 (videoUUID: string) {
    return this.segmentsSha256.get(videoUUID)
  }

  stopSessionOf (videoId: number) {
    const sessionId = this.videoSessions.get(videoId)
    if (!sessionId) return

    this.videoSessions.delete(videoId)
    this.abortSession(sessionId)
  }

  getLiveQuotaUsedByUser (userId: number) {
    const currentLives = this.livesPerUser.get(userId)
    if (!currentLives) return 0

    return currentLives.reduce((sum, obj) => sum + obj.size, 0)
  }

  private getContext () {
    return context
  }

  private abortSession (id: string) {
    const session = this.getContext().sessions.get(id)
    if (session) {
      session.stop()
      this.getContext().sessions.delete(id)
    }

    const transSession = this.transSessions.get(id)
    if (transSession) {
      transSession.kill('SIGINT')
      this.transSessions.delete(id)
    }
  }

  private async handleSession (sessionId: string, streamPath: string, streamKey: string) {
    const videoLive = await VideoLiveModel.loadByStreamKey(streamKey)
    if (!videoLive) {
      logger.warn('Unknown live video with stream key %s.', streamKey)
      return this.abortSession(sessionId)
    }

    const video = videoLive.Video
    if (video.isBlacklisted()) {
      logger.warn('Video is blacklisted. Refusing stream %s.', streamKey)
      return this.abortSession(sessionId)
    }

    this.videoSessions.set(video.id, sessionId)

    const playlistUrl = WEBSERVER.URL + VideoStreamingPlaylistModel.getHlsMasterPlaylistStaticPath(video.uuid)

    const session = this.getContext().sessions.get(sessionId)
    const rtmpUrl = 'rtmp://127.0.0.1:' + config.rtmp.port + streamPath

    const [ resolutionResult, fps ] = await Promise.all([
      getVideoFileResolution(rtmpUrl),
      getVideoFileFPS(rtmpUrl)
    ])

    const resolutionsEnabled = CONFIG.LIVE.TRANSCODING.ENABLED
      ? computeResolutionsToTranscode(resolutionResult.videoFileResolution, 'live')
      : []

    logger.info('Will mux/transcode live video of original resolution %d.', session.videoHeight, { resolutionsEnabled })

    const [ videoStreamingPlaylist ] = await VideoStreamingPlaylistModel.upsert({
      videoId: video.id,
      playlistUrl,
      segmentsSha256Url: WEBSERVER.URL + VideoStreamingPlaylistModel.getHlsSha256SegmentsStaticPath(video.uuid, video.isLive),
      p2pMediaLoaderInfohashes: VideoStreamingPlaylistModel.buildP2PMediaLoaderInfoHashes(playlistUrl, resolutionsEnabled),
      p2pMediaLoaderPeerVersion: P2P_MEDIA_LOADER_PEER_VERSION,

      type: VideoStreamingPlaylistType.HLS
    }, { returning: true }) as [ MStreamingPlaylist, boolean ]

    return this.runMuxing({
      sessionId,
      videoLive,
      playlist: videoStreamingPlaylist,
      originalResolution: session.videoHeight,
      rtmpUrl,
      fps,
      resolutionsEnabled
    })
  }

  private async runMuxing (options: {
    sessionId: string
    videoLive: MVideoLiveVideo
    playlist: MStreamingPlaylist
    rtmpUrl: string
    fps: number
    resolutionsEnabled: number[]
    originalResolution: number
  }) {
    const { sessionId, videoLive, playlist, resolutionsEnabled, originalResolution, fps, rtmpUrl } = options
    const startStreamDateTime = new Date().getTime()
    const allResolutions = resolutionsEnabled.concat([ originalResolution ])

    const user = await UserModel.loadByLiveId(videoLive.id)
    if (!this.livesPerUser.has(user.id)) {
      this.livesPerUser.set(user.id, [])
    }

    const currentUserLive = { liveId: videoLive.id, videoId: videoLive.videoId, size: 0 }
    const livesOfUser = this.livesPerUser.get(user.id)
    livesOfUser.push(currentUserLive)

    for (let i = 0; i < allResolutions.length; i++) {
      const resolution = allResolutions[i]

      VideoFileModel.upsert({
        resolution,
        size: -1,
        extname: '.ts',
        infoHash: null,
        fps,
        videoStreamingPlaylistId: playlist.id
      }).catch(err => {
        logger.error('Cannot create file for live streaming.', { err })
      })
    }

    const outPath = getHLSDirectory(videoLive.Video)
    await ensureDir(outPath)

    const videoUUID = videoLive.Video.uuid
    const deleteSegments = videoLive.saveReplay === false

    const ffmpegExec = CONFIG.LIVE.TRANSCODING.ENABLED
      ? runLiveTranscoding(rtmpUrl, outPath, allResolutions, fps, deleteSegments)
      : runLiveMuxing(rtmpUrl, outPath, deleteSegments)

    logger.info('Running live muxing/transcoding for %s.', videoUUID)
    this.transSessions.set(sessionId, ffmpegExec)

    const tsWatcher = chokidar.watch(outPath + '/*.ts')

    const updateSegment = segmentPath => this.segmentsSha256Queue.push({ operation: 'update', segmentPath, videoUUID })

    const addHandler = segmentPath => {
      updateSegment(segmentPath)

      if (this.isDurationConstraintValid(startStreamDateTime) !== true) {
        logger.info('Stopping session of %s: max duration exceeded.', videoUUID)

        this.stopSessionOf(videoLive.videoId)
      }

      // Check user quota if the user enabled replay saving
      if (videoLive.saveReplay === true) {
        stat(segmentPath)
          .then(segmentStat => {
            currentUserLive.size += segmentStat.size
          })
          .then(() => this.isQuotaConstraintValid(user, videoLive))
          .then(quotaValid => {
            if (quotaValid !== true) {
              logger.info('Stopping session of %s: user quota exceeded.', videoUUID)

              this.stopSessionOf(videoLive.videoId)
            }
          })
          .catch(err => logger.error('Cannot stat %s or check quota of %d.', segmentPath, user.id, { err }))
      }
    }

    const deleteHandler = segmentPath => this.segmentsSha256Queue.push({ operation: 'delete', segmentPath, videoUUID })

    tsWatcher.on('add', p => addHandler(p))
    tsWatcher.on('change', p => updateSegment(p))
    tsWatcher.on('unlink', p => deleteHandler(p))

    const masterWatcher = chokidar.watch(outPath + '/master.m3u8')
    masterWatcher.on('add', async () => {
      try {
        const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(videoLive.videoId)

        video.state = VideoState.PUBLISHED
        await video.save()
        videoLive.Video = video

        await federateVideoIfNeeded(video, false)

        PeerTubeSocket.Instance.sendVideoLiveNewState(video)
      } catch (err) {
        logger.error('Cannot federate video %d.', videoLive.videoId, { err })
      } finally {
        masterWatcher.close()
          .catch(err => logger.error('Cannot close master watcher of %s.', outPath, { err }))
      }
    })

    const onFFmpegEnded = () => {
      logger.info('RTMP transmuxing for video %s ended. Scheduling cleanup', rtmpUrl)

      this.transSessions.delete(sessionId)

      Promise.all([ tsWatcher.close(), masterWatcher.close() ])
        .catch(err => logger.error('Cannot close watchers of %s.', outPath, { err }))

      this.onEndTransmuxing(videoLive.Video.id)
        .catch(err => logger.error('Error in closed transmuxing.', { err }))
    }

    ffmpegExec.on('error', (err, stdout, stderr) => {
      onFFmpegEnded()

      // Don't care that we killed the ffmpeg process
      if (err?.message?.includes('Exiting normally')) return

      logger.error('Live transcoding error.', { err, stdout, stderr })

      this.abortSession(sessionId)
    })

    ffmpegExec.on('end', () => onFFmpegEnded())
  }

  private async onEndTransmuxing (videoId: number, cleanupNow = false) {
    try {
      const fullVideo = await VideoModel.loadAndPopulateAccountAndServerAndTags(videoId)
      if (!fullVideo) return

      JobQueue.Instance.createJob({
        type: 'video-live-ending',
        payload: {
          videoId: fullVideo.id
        }
      }, { delay: cleanupNow ? 0 : VIDEO_LIVE.CLEANUP_DELAY })

      fullVideo.state = VideoState.LIVE_ENDED
      await fullVideo.save()

      PeerTubeSocket.Instance.sendVideoLiveNewState(fullVideo)

      await federateVideoIfNeeded(fullVideo, false)
    } catch (err) {
      logger.error('Cannot save/federate new video state of live streaming.', { err })
    }
  }

  private async addSegmentSha (options: SegmentSha256QueueParam) {
    const segmentName = basename(options.segmentPath)
    logger.debug('Updating live sha segment %s.', options.segmentPath)

    const shaResult = await buildSha256Segment(options.segmentPath)

    if (!this.segmentsSha256.has(options.videoUUID)) {
      this.segmentsSha256.set(options.videoUUID, new Map())
    }

    const filesMap = this.segmentsSha256.get(options.videoUUID)
    filesMap.set(segmentName, shaResult)
  }

  private removeSegmentSha (options: SegmentSha256QueueParam) {
    const segmentName = basename(options.segmentPath)

    logger.debug('Removing live sha segment %s.', options.segmentPath)

    const filesMap = this.segmentsSha256.get(options.videoUUID)
    if (!filesMap) {
      logger.warn('Unknown files map to remove sha for %s.', options.videoUUID)
      return
    }

    if (!filesMap.has(segmentName)) {
      logger.warn('Unknown segment in files map for video %s and segment %s.', options.videoUUID, options.segmentPath)
      return
    }

    filesMap.delete(segmentName)
  }

  private isDurationConstraintValid (streamingStartTime: number) {
    const maxDuration = CONFIG.LIVE.MAX_DURATION
    // No limit
    if (maxDuration === null) return true

    const now = new Date().getTime()
    const max = streamingStartTime + maxDuration

    return now <= max
  }

  private async isQuotaConstraintValid (user: MUserId, live: MVideoLive) {
    if (live.saveReplay !== true) return true

    return this.isAbleToUploadVideoWithCache(user.id)
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  LiveManager
}
