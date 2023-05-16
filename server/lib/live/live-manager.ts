import { readdir, readFile } from 'fs-extra'
import { createServer, Server } from 'net'
import { join } from 'path'
import { createServer as createServerTLS, Server as ServerTLS } from 'tls'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { CONFIG, registerConfigChangedHandler } from '@server/initializers/config'
import { VIDEO_LIVE, WEBSERVER } from '@server/initializers/constants'
import { sequelizeTypescript } from '@server/initializers/database'
import { RunnerJobModel } from '@server/models/runner/runner-job'
import { UserModel } from '@server/models/user/user'
import { VideoModel } from '@server/models/video/video'
import { VideoLiveModel } from '@server/models/video/video-live'
import { VideoLiveReplaySettingModel } from '@server/models/video/video-live-replay-setting'
import { VideoLiveSessionModel } from '@server/models/video/video-live-session'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist'
import { MVideo, MVideoLiveSession, MVideoLiveVideo, MVideoLiveVideoWithSetting } from '@server/types/models'
import { pick, wait } from '@shared/core-utils'
import { ffprobePromise, getVideoStreamBitrate, getVideoStreamDimensionsInfo, getVideoStreamFPS, hasAudioStream } from '@shared/ffmpeg'
import { LiveVideoError, VideoState } from '@shared/models'
import { federateVideoIfNeeded } from '../activitypub/videos'
import { JobQueue } from '../job-queue'
import { getLiveReplayBaseDirectory } from '../paths'
import { PeerTubeSocket } from '../peertube-socket'
import { Hooks } from '../plugins/hooks'
import { computeResolutionsToTranscode } from '../transcoding/transcoding-resolutions'
import { LiveQuotaStore } from './live-quota-store'
import { cleanupAndDestroyPermanentLive, getLiveSegmentTime } from './live-utils'
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
  private readonly videoSessions = new Map<string, string>()

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
      const inputLocalUrl = session.inputOriginLocalUrl + streamPath
      const inputPublicUrl = session.inputOriginPublicUrl + streamPath

      this.handleSession({ sessionId, inputPublicUrl, inputLocalUrl, streamKey: splittedPath[2] })
        .catch(err => logger.error('Cannot handle sessions.', { err, ...lTags(sessionId) }))
    })

    events.on('donePublish', sessionId => {
      logger.info('Live session ended.', { sessionId, ...lTags(sessionId) })

      // Force session aborting, so we kill ffmpeg even if it still has data to process (slow CPU)
      setTimeout(() => this.abortSession(sessionId), 2000)
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

        session.inputOriginLocalUrl = 'rtmp://127.0.0.1:' + CONFIG.LIVE.RTMP.PORT
        session.inputOriginPublicUrl = WEBSERVER.RTMP_URL
        session.run()
      })

      this.rtmpServer.on('error', err => {
        logger.error('Cannot run RTMP server.', { err, ...lTags() })
      })

      this.rtmpServer.listen(CONFIG.LIVE.RTMP.PORT, CONFIG.LIVE.RTMP.HOSTNAME)
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

        session.inputOriginLocalUrl = 'rtmps://127.0.0.1:' + CONFIG.LIVE.RTMPS.PORT
        session.inputOriginPublicUrl = WEBSERVER.RTMPS_URL
        session.run()
      })

      this.rtmpsServer.on('error', err => {
        logger.error('Cannot run RTMPS server.', { err, ...lTags() })
      })

      this.rtmpsServer.listen(CONFIG.LIVE.RTMPS.PORT, CONFIG.LIVE.RTMPS.HOSTNAME)
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

  stopSessionOf (videoUUID: string, error: LiveVideoError | null) {
    const sessionId = this.videoSessions.get(videoUUID)
    if (!sessionId) {
      logger.debug('No live session to stop for video %s', videoUUID, lTags(sessionId, videoUUID))
      return
    }

    logger.info('Stopping live session of video %s', videoUUID, { error, ...lTags(sessionId, videoUUID) })

    this.saveEndingSession(videoUUID, error)
      .catch(err => logger.error('Cannot save ending session.', { err, ...lTags(sessionId, videoUUID) }))

    this.videoSessions.delete(videoUUID)
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

  private async handleSession (options: {
    sessionId: string
    inputLocalUrl: string
    inputPublicUrl: string
    streamKey: string
  }) {
    const { inputLocalUrl, inputPublicUrl, sessionId, streamKey } = options

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

    if (this.videoSessions.has(video.uuid)) {
      logger.warn('Video %s has already a live session. Refusing stream %s.', video.uuid, streamKey, lTags(sessionId, video.uuid))
      return this.abortSession(sessionId)
    }

    // Cleanup old potential live (could happen with a permanent live)
    const oldStreamingPlaylist = await VideoStreamingPlaylistModel.loadHLSPlaylistByVideo(video.id)
    if (oldStreamingPlaylist) {
      if (!videoLive.permanentLive) throw new Error('Found previous session in a non permanent live: ' + video.uuid)

      await cleanupAndDestroyPermanentLive(video, oldStreamingPlaylist)
    }

    this.videoSessions.set(video.uuid, sessionId)

    const now = Date.now()
    const probe = await ffprobePromise(inputLocalUrl)

    const [ { resolution, ratio }, fps, bitrate, hasAudio ] = await Promise.all([
      getVideoStreamDimensionsInfo(inputLocalUrl, probe),
      getVideoStreamFPS(inputLocalUrl, probe),
      getVideoStreamBitrate(inputLocalUrl, probe),
      hasAudioStream(inputLocalUrl, probe)
    ])

    logger.info(
      '%s probing took %d ms (bitrate: %d, fps: %d, resolution: %d)',
      inputLocalUrl, Date.now() - now, bitrate, fps, resolution, lTags(sessionId, video.uuid)
    )

    const allResolutions = await Hooks.wrapObject(
      this.buildAllResolutionsToTranscode(resolution, hasAudio),
      'filter:transcoding.auto.resolutions-to-transcode.result',
      { video }
    )

    logger.info(
      'Handling live video of original resolution %d.', resolution,
      { allResolutions, ...lTags(sessionId, video.uuid) }
    )

    return this.runMuxingSession({
      sessionId,
      videoLive,

      inputLocalUrl,
      inputPublicUrl,
      fps,
      bitrate,
      ratio,
      allResolutions,
      hasAudio
    })
  }

  private async runMuxingSession (options: {
    sessionId: string
    videoLive: MVideoLiveVideoWithSetting

    inputLocalUrl: string
    inputPublicUrl: string

    fps: number
    bitrate: number
    ratio: number
    allResolutions: number[]
    hasAudio: boolean
  }) {
    const { sessionId, videoLive } = options
    const videoUUID = videoLive.Video.uuid
    const localLTags = lTags(sessionId, videoUUID)

    const liveSession = await this.saveStartingSession(videoLive)

    const user = await UserModel.loadByLiveId(videoLive.id)
    LiveQuotaStore.Instance.addNewLive(user.id, videoLive.id)

    const muxingSession = new MuxingSession({
      context: this.getContext(),
      sessionId,
      videoLive,
      user,

      ...pick(options, [ 'inputLocalUrl', 'inputPublicUrl', 'bitrate', 'ratio', 'fps', 'allResolutions', 'hasAudio' ])
    })

    muxingSession.on('live-ready', () => this.publishAndFederateLive(videoLive, localLTags))

    muxingSession.on('bad-socket-health', ({ videoUUID }) => {
      logger.error(
        'Too much data in client socket stream (ffmpeg is too slow to transcode the video).' +
        ' Stopping session of video %s.', videoUUID,
        localLTags
      )

      this.stopSessionOf(videoUUID, LiveVideoError.BAD_SOCKET_HEALTH)
    })

    muxingSession.on('duration-exceeded', ({ videoUUID }) => {
      logger.info('Stopping session of %s: max duration exceeded.', videoUUID, localLTags)

      this.stopSessionOf(videoUUID, LiveVideoError.DURATION_EXCEEDED)
    })

    muxingSession.on('quota-exceeded', ({ videoUUID }) => {
      logger.info('Stopping session of %s: user quota exceeded.', videoUUID, localLTags)

      this.stopSessionOf(videoUUID, LiveVideoError.QUOTA_EXCEEDED)
    })

    muxingSession.on('transcoding-error', ({ videoUUID }) => {
      this.stopSessionOf(videoUUID, LiveVideoError.FFMPEG_ERROR)
    })

    muxingSession.on('transcoding-end', ({ videoUUID }) => {
      this.onMuxingFFmpegEnd(videoUUID, sessionId)
    })

    muxingSession.on('after-cleanup', ({ videoUUID }) => {
      this.muxingSessions.delete(sessionId)

      LiveQuotaStore.Instance.removeLive(user.id, videoLive.id)

      muxingSession.destroy()

      return this.onAfterMuxingCleanup({ videoUUID, liveSession })
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
      const video = await VideoModel.loadFull(videoId)

      logger.info('Will publish and federate live %s.', video.url, localLTags)

      video.state = VideoState.PUBLISHED
      video.publishedAt = new Date()
      await video.save()

      live.Video = video

      await wait(getLiveSegmentTime(live.latencyMode) * 1000 * VIDEO_LIVE.EDGE_LIVE_DELAY_SEGMENTS_NOTIFICATION)

      try {
        await federateVideoIfNeeded(video, false)
      } catch (err) {
        logger.error('Cannot federate live video %s.', video.url, { err, ...localLTags })
      }

      PeerTubeSocket.Instance.sendVideoLiveNewState(video)
    } catch (err) {
      logger.error('Cannot save/federate live video %d.', videoId, { err, ...localLTags })
    }
  }

  private onMuxingFFmpegEnd (videoUUID: string, sessionId: string) {
    // Session already cleaned up
    if (!this.videoSessions.has(videoUUID)) return

    this.videoSessions.delete(videoUUID)

    this.saveEndingSession(videoUUID, null)
      .catch(err => logger.error('Cannot save ending session.', { err, ...lTags(sessionId) }))
  }

  private async onAfterMuxingCleanup (options: {
    videoUUID: string
    liveSession?: MVideoLiveSession
    cleanupNow?: boolean // Default false
  }) {
    const { videoUUID, liveSession: liveSessionArg, cleanupNow = false } = options

    logger.debug('Live of video %s has been cleaned up. Moving to its next state.', videoUUID, lTags(videoUUID))

    try {
      const fullVideo = await VideoModel.loadFull(videoUUID)
      if (!fullVideo) return

      const live = await VideoLiveModel.loadByVideoId(fullVideo.id)

      const liveSession = liveSessionArg ?? await VideoLiveSessionModel.findLatestSessionOf(fullVideo.id)

      // On server restart during a live
      if (!liveSession.endDate) {
        liveSession.endDate = new Date()
        await liveSession.save()
      }

      JobQueue.Instance.createJobAsync({
        type: 'video-live-ending',
        payload: {
          videoId: fullVideo.id,

          replayDirectory: live.saveReplay
            ? await this.findReplayDirectory(fullVideo)
            : undefined,

          liveSessionId: liveSession.id,
          streamingPlaylistId: fullVideo.getHLSPlaylist()?.id,

          publishedAt: fullVideo.publishedAt.toISOString()
        },

        delay: cleanupNow
          ? 0
          : VIDEO_LIVE.CLEANUP_DELAY
      })

      fullVideo.state = live.permanentLive
        ? VideoState.WAITING_FOR_LIVE
        : VideoState.LIVE_ENDED

      await fullVideo.save()

      PeerTubeSocket.Instance.sendVideoLiveNewState(fullVideo)

      await federateVideoIfNeeded(fullVideo, false)
    } catch (err) {
      logger.error('Cannot save/federate new video state of live streaming of video %s.', videoUUID, { err, ...lTags(videoUUID) })
    }
  }

  private async handleBrokenLives () {
    await RunnerJobModel.cancelAllJobs({ type: 'live-rtmp-hls-transcoding' })

    const videoUUIDs = await VideoModel.listPublishedLiveUUIDs()

    for (const uuid of videoUUIDs) {
      await this.onAfterMuxingCleanup({ videoUUID: uuid, cleanupNow: true })
    }
  }

  private async findReplayDirectory (video: MVideo) {
    const directory = getLiveReplayBaseDirectory(video)
    const files = await readdir(directory)

    if (files.length === 0) return undefined

    return join(directory, files.sort().reverse()[0])
  }

  private buildAllResolutionsToTranscode (originResolution: number, hasAudio: boolean) {
    const includeInput = CONFIG.LIVE.TRANSCODING.ALWAYS_TRANSCODE_ORIGINAL_RESOLUTION

    const resolutionsEnabled = CONFIG.LIVE.TRANSCODING.ENABLED
      ? computeResolutionsToTranscode({ input: originResolution, type: 'live', includeInput, strictLower: false, hasAudio })
      : []

    if (resolutionsEnabled.length === 0) {
      return [ originResolution ]
    }

    return resolutionsEnabled
  }

  private async saveStartingSession (videoLive: MVideoLiveVideoWithSetting) {
    const replaySettings = videoLive.saveReplay
      ? new VideoLiveReplaySettingModel({
        privacy: videoLive.ReplaySetting.privacy
      })
      : null

    return sequelizeTypescript.transaction(async t => {
      if (videoLive.saveReplay) {
        await replaySettings.save({ transaction: t })
      }

      return VideoLiveSessionModel.create({
        startDate: new Date(),
        liveVideoId: videoLive.videoId,
        saveReplay: videoLive.saveReplay,
        replaySettingId: videoLive.saveReplay ? replaySettings.id : null,
        endingProcessed: false
      }, { transaction: t })
    })
  }

  private async saveEndingSession (videoUUID: string, error: LiveVideoError | null) {
    const liveSession = await VideoLiveSessionModel.findCurrentSessionOf(videoUUID)
    if (!liveSession) return

    liveSession.endDate = new Date()
    liveSession.error = error

    return liveSession.save()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  LiveManager
}
