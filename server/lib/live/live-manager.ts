
import { readFile } from 'fs-extra'
import { createServer, Server } from 'net'
import { createServer as createServerTLS, Server as ServerTLS } from 'tls'
import {
  computeLowerResolutionsToTranscode,
  ffprobePromise,
  getLiveSegmentTime,
  getVideoStreamBitrate,
  getVideoStreamDimensionsInfo,
  getVideoStreamFPS
} from '@server/helpers/ffmpeg'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { CONFIG, registerConfigChangedHandler } from '@server/initializers/config'
import { P2P_MEDIA_LOADER_PEER_VERSION, VIDEO_LIVE } from '@server/initializers/constants'
import { UserModel } from '@server/models/user/user'
import { VideoModel } from '@server/models/video/video'
import { VideoLiveModel } from '@server/models/video/video-live'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist'
import { MStreamingPlaylistVideo, MVideo, MVideoLiveVideo } from '@server/types/models'
import { VideoState, VideoStreamingPlaylistType } from '@shared/models'
import { federateVideoIfNeeded } from '../activitypub/videos'
import { JobQueue } from '../job-queue'
import { generateHLSMasterPlaylistFilename, generateHlsSha256SegmentsFilename } from '../paths'
import { PeerTubeSocket } from '../peertube-socket'
import { LiveQuotaStore } from './live-quota-store'
import { LiveSegmentShaStore } from './live-segment-sha-store'
import { cleanupLive } from './live-utils'
import { MuxingSession } from './shared'

const NodeRtmpSession = require('node-media-server/src/node_rtmp_session')
const context = require('node-media-server/src/node_core_ctx')
const nodeMediaServerLogger = require('node-media-server/src/node_core_logger')

// Disable node media server logs
nodeMediaServerLogger.setLogType(0)

const config = {
  rtmp: {
    port: CONFIG.LIVE.RTMP.PORT,
    chunk_size: VIDEO_LIVE.RTMP.CHUNK_SIZE,
    gop_cache: VIDEO_LIVE.RTMP.GOP_CACHE,
    ping: VIDEO_LIVE.RTMP.PING,
    ping_timeout: VIDEO_LIVE.RTMP.PING_TIMEOUT
  }
}

const lTags = loggerTagsFactory('live')

class LiveManager {

  private static instance: LiveManager

  private readonly muxingSessions = new Map<string, MuxingSession>()
  private readonly videoSessions = new Map<number, string>()

  private rtmpServer: Server
  private rtmpsServer: ServerTLS

  private running = false

  private constructor () {
  }

  init () {
    const events = this.getContext().nodeEvent
    events.on('postPublish', (sessionId: string, streamPath: string) => {
      logger.debug('RTMP received stream', { id: sessionId, streamPath, ...lTags(sessionId) })

      const splittedPath = streamPath.split('/')
      if (splittedPath.length !== 3 || splittedPath[1] !== VIDEO_LIVE.RTMP.BASE_PATH) {
        logger.warn('Live path is incorrect.', { streamPath, ...lTags(sessionId) })
        return this.abortSession(sessionId)
      }

      const session = this.getContext().sessions.get(sessionId)

      this.handleSession(sessionId, session.inputOriginUrl + streamPath, splittedPath[2])
        .catch(err => logger.error('Cannot handle sessions.', { err, ...lTags(sessionId) }))
    })

    events.on('donePublish', sessionId => {
      logger.info('Live session ended.', { sessionId, ...lTags(sessionId) })
    })

    registerConfigChangedHandler(() => {
      if (!this.running && CONFIG.LIVE.ENABLED === true) {
        this.run().catch(err => logger.error('Cannot run live server.', { err }))
        return
      }

      if (this.running && CONFIG.LIVE.ENABLED === false) {
        this.stop()
      }
    })

    // Cleanup broken lives, that were terminated by a server restart for example
    this.handleBrokenLives()
      .catch(err => logger.error('Cannot handle broken lives.', { err, ...lTags() }))
  }

  async run () {
    this.running = true

    if (CONFIG.LIVE.RTMP.ENABLED) {
      logger.info('Running RTMP server on port %d', CONFIG.LIVE.RTMP.PORT, lTags())

      this.rtmpServer = createServer(socket => {
        const session = new NodeRtmpSession(config, socket)

        session.inputOriginUrl = 'rtmp://127.0.0.1:' + CONFIG.LIVE.RTMP.PORT
        session.run()
      })

      this.rtmpServer.on('error', err => {
        logger.error('Cannot run RTMP server.', { err, ...lTags() })
      })

      this.rtmpServer.listen(CONFIG.LIVE.RTMP.PORT)
    }

    if (CONFIG.LIVE.RTMPS.ENABLED) {
      logger.info('Running RTMPS server on port %d', CONFIG.LIVE.RTMPS.PORT, lTags())

      const [ key, cert ] = await Promise.all([
        readFile(CONFIG.LIVE.RTMPS.KEY_FILE),
        readFile(CONFIG.LIVE.RTMPS.CERT_FILE)
      ])
      const serverOptions = { key, cert }

      this.rtmpsServer = createServerTLS(serverOptions, socket => {
        const session = new NodeRtmpSession(config, socket)

        session.inputOriginUrl = 'rtmps://127.0.0.1:' + CONFIG.LIVE.RTMPS.PORT
        session.run()
      })

      this.rtmpsServer.on('error', err => {
        logger.error('Cannot run RTMPS server.', { err, ...lTags() })
      })

      this.rtmpsServer.listen(CONFIG.LIVE.RTMPS.PORT)
    }
  }

  stop () {
    this.running = false

    if (this.rtmpServer) {
      logger.info('Stopping RTMP server.', lTags())

      this.rtmpServer.close()
      this.rtmpServer = undefined
    }

    if (this.rtmpsServer) {
      logger.info('Stopping RTMPS server.', lTags())

      this.rtmpsServer.close()
      this.rtmpsServer = undefined
    }

    // Sessions is an object
    this.getContext().sessions.forEach((session: any) => {
      if (session instanceof NodeRtmpSession) {
        session.stop()
      }
    })
  }

  isRunning () {
    return !!this.rtmpServer
  }

  stopSessionOf (videoId: number) {
    const sessionId = this.videoSessions.get(videoId)
    if (!sessionId) return

    this.videoSessions.delete(videoId)
    this.abortSession(sessionId)
  }

  private getContext () {
    return context
  }

  private abortSession (sessionId: string) {
    const session = this.getContext().sessions.get(sessionId)
    if (session) {
      session.stop()
      this.getContext().sessions.delete(sessionId)
    }

    const muxingSession = this.muxingSessions.get(sessionId)
    if (muxingSession) {
      // Muxing session will fire and event so we correctly cleanup the session
      muxingSession.abort()

      this.muxingSessions.delete(sessionId)
    }
  }

  private async handleSession (sessionId: string, inputUrl: string, streamKey: string) {
    const videoLive = await VideoLiveModel.loadByStreamKey(streamKey)
    if (!videoLive) {
      logger.warn('Unknown live video with stream key %s.', streamKey, lTags(sessionId))
      return this.abortSession(sessionId)
    }

    const video = videoLive.Video
    if (video.isBlacklisted()) {
      logger.warn('Video is blacklisted. Refusing stream %s.', streamKey, lTags(sessionId, video.uuid))
      return this.abortSession(sessionId)
    }

    // Cleanup old potential live files (could happen with a permanent live)
    LiveSegmentShaStore.Instance.cleanupShaSegments(video.uuid)

    const oldStreamingPlaylist = await VideoStreamingPlaylistModel.loadHLSPlaylistByVideo(video.id)
    if (oldStreamingPlaylist) {
      await cleanupLive(video, oldStreamingPlaylist)
    }

    this.videoSessions.set(video.id, sessionId)

    const now = Date.now()
    const probe = await ffprobePromise(inputUrl)

    const [ { resolution, ratio }, fps, bitrate ] = await Promise.all([
      getVideoStreamDimensionsInfo(inputUrl, probe),
      getVideoStreamFPS(inputUrl, probe),
      getVideoStreamBitrate(inputUrl, probe)
    ])

    logger.info(
      '%s probing took %d ms (bitrate: %d, fps: %d, resolution: %d)',
      inputUrl, Date.now() - now, bitrate, fps, resolution, lTags(sessionId, video.uuid)
    )

    const allResolutions = this.buildAllResolutionsToTranscode(resolution)

    logger.info(
      'Will mux/transcode live video of original resolution %d.', resolution,
      { allResolutions, ...lTags(sessionId, video.uuid) }
    )

    const streamingPlaylist = await this.createLivePlaylist(video, allResolutions)

    return this.runMuxingSession({
      sessionId,
      videoLive,
      streamingPlaylist,
      inputUrl,
      fps,
      bitrate,
      ratio,
      allResolutions
    })
  }

  private async runMuxingSession (options: {
    sessionId: string
    videoLive: MVideoLiveVideo
    streamingPlaylist: MStreamingPlaylistVideo
    inputUrl: string
    fps: number
    bitrate: number
    ratio: number
    allResolutions: number[]
  }) {
    const { sessionId, videoLive, streamingPlaylist, allResolutions, fps, bitrate, ratio, inputUrl } = options
    const videoUUID = videoLive.Video.uuid
    const localLTags = lTags(sessionId, videoUUID)

    const user = await UserModel.loadByLiveId(videoLive.id)
    LiveQuotaStore.Instance.addNewLive(user.id, videoLive.id)

    const muxingSession = new MuxingSession({
      context: this.getContext(),
      user,
      sessionId,
      videoLive,
      streamingPlaylist,
      inputUrl,
      bitrate,
      ratio,
      fps,
      allResolutions
    })

    muxingSession.on('master-playlist-created', () => this.publishAndFederateLive(videoLive, localLTags))

    muxingSession.on('bad-socket-health', ({ videoId }) => {
      logger.error(
        'Too much data in client socket stream (ffmpeg is too slow to transcode the video).' +
        ' Stopping session of video %s.', videoUUID,
        localLTags
      )

      this.stopSessionOf(videoId)
    })

    muxingSession.on('duration-exceeded', ({ videoId }) => {
      logger.info('Stopping session of %s: max duration exceeded.', videoUUID, localLTags)

      this.stopSessionOf(videoId)
    })

    muxingSession.on('quota-exceeded', ({ videoId }) => {
      logger.info('Stopping session of %s: user quota exceeded.', videoUUID, localLTags)

      this.stopSessionOf(videoId)
    })

    muxingSession.on('ffmpeg-error', ({ sessionId }) => this.abortSession(sessionId))
    muxingSession.on('ffmpeg-end', ({ videoId }) => {
      this.onMuxingFFmpegEnd(videoId)
    })

    muxingSession.on('after-cleanup', ({ videoId }) => {
      this.muxingSessions.delete(sessionId)

      muxingSession.destroy()

      return this.onAfterMuxingCleanup(videoId)
        .catch(err => logger.error('Error in end transmuxing.', { err, ...localLTags }))
    })

    this.muxingSessions.set(sessionId, muxingSession)

    muxingSession.runMuxing()
      .catch(err => {
        logger.error('Cannot run muxing.', { err, ...localLTags })
        this.abortSession(sessionId)
      })
  }

  private async publishAndFederateLive (live: MVideoLiveVideo, localLTags: { tags: string[] }) {
    const videoId = live.videoId

    try {
      const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(videoId)

      logger.info('Will publish and federate live %s.', video.url, localLTags)

      video.state = VideoState.PUBLISHED
      video.publishedAt = new Date()
      await video.save()

      live.Video = video

      setTimeout(() => {
        federateVideoIfNeeded(video, false)
          .catch(err => logger.error('Cannot federate live video %s.', video.url, { err, ...localLTags }))

        PeerTubeSocket.Instance.sendVideoLiveNewState(video)
      }, getLiveSegmentTime(live.latencyMode) * 1000 * VIDEO_LIVE.EDGE_LIVE_DELAY_SEGMENTS_NOTIFICATION)
    } catch (err) {
      logger.error('Cannot save/federate live video %d.', videoId, { err, ...localLTags })
    }
  }

  private onMuxingFFmpegEnd (videoId: number) {
    this.videoSessions.delete(videoId)
  }

  private async onAfterMuxingCleanup (videoUUID: string, cleanupNow = false) {
    try {
      const fullVideo = await VideoModel.loadAndPopulateAccountAndServerAndTags(videoUUID)
      if (!fullVideo) return

      const live = await VideoLiveModel.loadByVideoId(fullVideo.id)

      if (!live.permanentLive) {
        JobQueue.Instance.createJob({
          type: 'video-live-ending',
          payload: {
            videoId: fullVideo.id
          }
        }, { delay: cleanupNow ? 0 : VIDEO_LIVE.CLEANUP_DELAY })

        fullVideo.state = VideoState.LIVE_ENDED
      } else {
        fullVideo.state = VideoState.WAITING_FOR_LIVE
      }

      await fullVideo.save()

      PeerTubeSocket.Instance.sendVideoLiveNewState(fullVideo)

      await federateVideoIfNeeded(fullVideo, false)
    } catch (err) {
      logger.error('Cannot save/federate new video state of live streaming of video %d.', videoUUID, { err, ...lTags(videoUUID) })
    }
  }

  private async handleBrokenLives () {
    const videoUUIDs = await VideoModel.listPublishedLiveUUIDs()

    for (const uuid of videoUUIDs) {
      await this.onAfterMuxingCleanup(uuid, true)
    }
  }

  private buildAllResolutionsToTranscode (originResolution: number) {
    const resolutionsEnabled = CONFIG.LIVE.TRANSCODING.ENABLED
      ? computeLowerResolutionsToTranscode(originResolution, 'live')
      : []

    return resolutionsEnabled.concat([ originResolution ])
  }

  private async createLivePlaylist (video: MVideo, allResolutions: number[]): Promise<MStreamingPlaylistVideo> {
    const playlist = await VideoStreamingPlaylistModel.loadOrGenerate(video)

    playlist.playlistFilename = generateHLSMasterPlaylistFilename(true)
    playlist.segmentsSha256Filename = generateHlsSha256SegmentsFilename(true)

    playlist.p2pMediaLoaderPeerVersion = P2P_MEDIA_LOADER_PEER_VERSION
    playlist.type = VideoStreamingPlaylistType.HLS

    playlist.assignP2PMediaLoaderInfoHashes(video, allResolutions)

    return playlist.save()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  LiveManager
}
