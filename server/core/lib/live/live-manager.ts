import { pick, timeoutPromise, wait } from '@peertube/peertube-core-utils'
import {
  ffprobePromise,
  getVideoStreamBitrate,
  getVideoStreamDimensionsInfo,
  getVideoStreamFPS,
  hasAudioStream,
  hasVideoStream
} from '@peertube/peertube-ffmpeg'
import { LiveVideoError, LiveVideoErrorType, VideoResolution, VideoState } from '@peertube/peertube-models'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG, registerConfigChangedHandler } from '@server/initializers/config.js'
import { VIDEO_LIVE, WEBSERVER } from '@server/initializers/constants.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { RunnerJobModel } from '@server/models/runner/runner-job.js'
import { UserModel } from '@server/models/user/user.js'
import { VideoLiveReplaySettingModel } from '@server/models/video/video-live-replay-setting.js'
import { VideoLiveSessionModel } from '@server/models/video/video-live-session.js'
import { VideoLiveModel } from '@server/models/video/video-live.js'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist.js'
import { VideoModel } from '@server/models/video/video.js'
import { MUser, MVideo, MVideoLiveVideo, MVideoLiveVideoWithSetting } from '@server/types/models/index.js'
import { FfprobeData } from 'fluent-ffmpeg'
import { pathExists } from 'fs-extra/esm'
import { readFile, readdir } from 'fs/promises'
import { Server, createServer } from 'net'
import context from 'node-media-server/src/node_core_ctx.js'
import nodeMediaServerLogger from 'node-media-server/src/node_core_logger.js'
import NodeRtmpSession from 'node-media-server/src/node_rtmp_session.js'
import { Server as ServerTLS, createServer as createServerTLS } from 'tls'
import { scheduleVideoFederation } from '../activitypub/videos/index.js'
import { JobQueue } from '../job-queue/index.js'
import { Notifier } from '../notifier/notifier.js'
import { getLiveReplayBaseDirectory } from '../paths.js'
import { PeerTubeSocket } from '../peertube-socket.js'
import { Hooks } from '../plugins/hooks.js'
import { computeResolutionsToTranscode } from '../transcoding/transcoding-resolutions.js'
import { isUserQuotaValid } from '../user.js'
import { LiveQuotaStore } from './live-quota-store.js'
import { cleanupAndDestroyPermanentLive, getLiveSegmentTime } from './live-utils.js'
import { MuxingSession } from './shared/index.js'

const logger = createLogger('live')

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

class LiveManager {
  private static instance: LiveManager

  private readonly muxingSessions = new Map<string, MuxingSession>()
  private readonly videoSessions = new Map<string, string>()

  // Video UUID -> cleanup of its current/last muxing session
  // A permanent live can be streamed again before the previous session finished to write its files on disk
  private readonly sessionCleanups = new Map<string, { sessionId: string, cleanup: Promise<void> }>()

  private rtmpServer: Server
  private rtmpsServer: ServerTLS

  private running = false

  private constructor () {
  }

  init () {
    const events = this.getContext().nodeEvent
    events.on('postPublish', (sessionId: string, streamPath: string) => {
      logger.withContext([ sessionId ], () => {
        // Don't log streamPath: it contains the stream key, which is a long lived secret
        logger.debug('RTMP received stream', { id: sessionId })

        const splittedPath = streamPath.split('/')
        if (splittedPath.length !== 3 || splittedPath[1] !== VIDEO_LIVE.RTMP.BASE_PATH) {
          logger.warn('Live path is incorrect.')
          return this.abortSession(sessionId)
        }

        const session = this.getContext().sessions.get(sessionId)
        const inputLocalUrl = session.inputOriginLocalUrl + streamPath
        const inputPublicUrl = session.inputOriginPublicUrl + streamPath

        this.handleSession({ sessionId, inputPublicUrl, inputLocalUrl, streamKey: splittedPath[2] })
          .catch(err => logger.error('Cannot handle session', { err }))
      })
    })

    events.on('donePublish', (sessionId: string) => {
      logger.withContext([ sessionId ], () => {
        logger.info('Live session ended.', { sessionId })

        // Force session aborting, so we kill ffmpeg even if it still has data to process (slow CPU)
        setTimeout(() => this.abortSession(sessionId), VIDEO_LIVE.ABORT_DELAY_ON_RTMP_DISCONNECT)
      })
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
      .catch(err => logger.error('Cannot handle broken lives.', { err }))
  }

  async run () {
    this.running = true

    if (CONFIG.LIVE.RTMP.ENABLED) {
      logger.info('Running RTMP server on port %d', CONFIG.LIVE.RTMP.PORT)

      this.rtmpServer = createServer(socket => {
        const session = new NodeRtmpSession(config, socket)

        session.inputOriginLocalUrl = 'rtmp://127.0.0.1:' + CONFIG.LIVE.RTMP.PORT
        session.inputOriginPublicUrl = WEBSERVER.RTMP_URL
        session.run()
      })

      this.rtmpServer.on('error', err => {
        logger.error('Cannot run RTMP server.', { err })
      })

      this.rtmpServer.listen(CONFIG.LIVE.RTMP.PORT, CONFIG.LIVE.RTMP.HOSTNAME)
    }

    if (CONFIG.LIVE.RTMPS.ENABLED) {
      logger.info('Running RTMPS server on port %d', CONFIG.LIVE.RTMPS.PORT)

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
        logger.error('Cannot run RTMPS server.', { err })
      })

      this.rtmpsServer.listen(CONFIG.LIVE.RTMPS.PORT, CONFIG.LIVE.RTMPS.HOSTNAME)
    }
  }

  stop () {
    this.running = false

    if (this.rtmpServer) {
      logger.info('Stopping RTMP server.')

      this.rtmpServer.close()
      this.rtmpServer = undefined
    }

    if (this.rtmpsServer) {
      logger.info('Stopping RTMPS server.')

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

  hasSession (sessionId: string) {
    return this.getContext().sessions.has(sessionId)
  }

  async stopSessionOfVideo (options: {
    videoUUID: string
    error: LiveVideoErrorType | null

    expectedSessionId?: string // Prevent stopping another session of permanent live
    errorOnReplay?: boolean
  }) {
    const { videoUUID, expectedSessionId, error } = options

    const sessionId = this.videoSessions.get(videoUUID)

    if (!sessionId) {
      logger.debug('No live session to stop for video %s', videoUUID)
      return
    }

    await logger.withContext([ videoUUID ], async () => {
      if (expectedSessionId && expectedSessionId !== sessionId) {
        logger.debug(`No live session ${expectedSessionId} to stop for video ${videoUUID} (current session: ${sessionId})`)
        return
      }

      this.videoSessions.delete(videoUUID)

      logger.info('Stopping live session of video %s', videoUUID, { error })

      // Await the ending session write before tearing down: abortSession() triggers ffmpeg shutdown,
      // which eventually fires 'after-cleanup' and onAfterMuxingCleanup() reading this same row
      // So this write must be committed first to avoid two unsynchronized writers racing on it
      try {
        await this.saveEndingSession(options)
      } catch (err) {
        logger.error('Cannot save ending session.', { err })
      }

      this.abortSession(sessionId)
    })
  }

  private getContext () {
    return context
  }

  // Don't remove the cleanup of a more recent session of the same video
  private deleteSessionCleanup (videoUUID: string, sessionId: string) {
    if (this.sessionCleanups.get(videoUUID)?.sessionId !== sessionId) return

    this.sessionCleanups.delete(videoUUID)
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

    logger.debug(`Handling session ${sessionId}`)

    const videoLive = await VideoLiveModel.loadByStreamKey(streamKey)
    if (!videoLive) {
      // Don't log the stream key, which is a long lived secret
      logger.warn('Unknown live video stream key.')
      return this.abortSession(sessionId)
    }

    const video = videoLive.Video

    await logger.withContext([ video.uuid ], async () => {
      if (video.isBlacklisted()) {
        logger.warn('Video is blacklisted. Refusing stream of video %s.', video.uuid)
        return this.abortSession(sessionId)
      }

      const user = await UserModel.loadByLiveId(videoLive.id)
      if (user.blocked) {
        logger.warn('User is blocked. Refusing stream of video %s.', video.uuid)
        return this.abortSession(sessionId)
      }

      if (this.videoSessions.has(video.uuid)) {
        logger.warn(`Video ${video.uuid} has already a live session ${this.videoSessions.get(video.uuid)}. Refusing stream.`)
        return this.abortSession(sessionId)
      }

      this.videoSessions.set(video.uuid, sessionId)

      try {
        if (videoLive.saveReplay && await isUserQuotaValid({ channelUserId: user.id, uploadSize: 1000 }) !== true) {
          logger.warn('User quota exceeded. Refusing stream of video %s.', video.uuid)

          try {
            await this.saveEndingSession({ videoUUID: video.uuid, error: LiveVideoError.QUOTA_EXCEEDED })
          } catch (err) {
            logger.error('Cannot save ending session of live with quota exceeded error.', { err })
          }

          this.videoSessions.delete(video.uuid)
          return this.abortSession(sessionId)
        }

        // A previous session of this permanent live may still be writing its last segments on disk
        // Wait for it, so we don't cleanup/write the same files from two sessions at the same time
        const previous = this.sessionCleanups.get(video.uuid)
        if (previous) {
          logger.info(
            'Waiting for the previous live session %s of video %s to be cleaned up.',
            previous.sessionId,
            video.uuid
          )

          // Never block this live forever if the previous cleanup is stuck (a hanging object storage upload for example)
          try {
            await timeoutPromise(previous.cleanup, VIDEO_LIVE.PREVIOUS_SESSION_CLEANUP_TIMEOUT)
          } catch (err) {
            logger.warn(
              'Previous live session %s of video %s is still not cleaned up, starting the new session anyway.',
              previous.sessionId,
              video.uuid,
              { err }
            )
          }
        }

        // Cleanup old potential live (could happen with a permanent live)
        const oldStreamingPlaylist = await VideoStreamingPlaylistModel.loadHLSByVideo(video.id)
        if (oldStreamingPlaylist) {
          if (!videoLive.permanentLive) throw new Error('Found previous session in a non permanent live: ' + video.uuid)

          PeerTubeSocket.Instance.sendVideoForceEnd(video)

          await cleanupAndDestroyPermanentLive(video, oldStreamingPlaylist)
        }
      } catch (err) {
        this.videoSessions.delete(video.uuid)

        throw err
      }

      logger.debug('Probing ' + inputLocalUrl)

      const now = Date.now()
      let probe: FfprobeData

      try {
        probe = await ffprobePromise(inputLocalUrl)
      } catch (err) {
        logger.error('Cannot probe ' + inputLocalUrl, { err })

        this.videoSessions.delete(video.uuid)
        return this.abortSession(sessionId)
      }

      const [ { resolution, ratio }, fps, bitrate, hasAudio, hasVideo ] = await Promise.all([
        getVideoStreamDimensionsInfo(inputLocalUrl, probe),
        getVideoStreamFPS(inputLocalUrl, probe),
        getVideoStreamBitrate(inputLocalUrl, probe),
        hasAudioStream(inputLocalUrl, probe),
        hasVideoStream(inputLocalUrl, probe)
      ])

      if (!hasAudio && !hasVideo) {
        logger.warn('Not audio and video streams were found for video %s. Refusing stream %s.', video.uuid, streamKey)

        this.videoSessions.delete(video.uuid)
        return this.abortSession(sessionId)
      }

      logger.info(
        '%s probing took %d ms (bitrate: %d, fps: %d, resolution: %d)',
        inputLocalUrl,
        Date.now() - now,
        bitrate,
        fps,
        resolution
      )

      const allResolutions = await Hooks.wrapObject(
        this.buildAllResolutionsToTranscode(resolution, hasAudio),
        'filter:transcoding.auto.resolutions-to-transcode.result',
        { video }
      )

      if (!hasAudio && allResolutions.length === 1 && allResolutions[0] === VideoResolution.H_NOVIDEO) {
        logger.warn(
          'Cannot stream live to audio only because no video stream is available for video %s. Refusing stream %s.',
          video.uuid,
          streamKey
        )

        this.videoSessions.delete(video.uuid)
        return this.abortSession(sessionId)
      }

      logger.info('Handling live video of original resolution %d.', resolution, { allResolutions })

      return this.runMuxingSession({
        sessionId,
        videoLive,

        user,

        inputLocalUrl,
        inputPublicUrl,

        fps,
        bitrate,
        ratio,

        inputResolution: resolution,
        allResolutions,

        hasAudio,
        hasVideo,
        probe
      })
    })
  }

  private async runMuxingSession (options: {
    sessionId: string
    videoLive: MVideoLiveVideoWithSetting

    user: MUser

    inputLocalUrl: string
    inputPublicUrl: string

    fps: number
    bitrate: number
    ratio: number

    inputResolution: number
    allResolutions: number[]

    hasAudio: boolean
    hasVideo: boolean
    probe: FfprobeData
  }) {
    const { sessionId, videoLive, user, ratio, allResolutions } = options
    const videoUUID = videoLive.Video.uuid

    const audioOnlyOutput = allResolutions.every(r => r === VideoResolution.H_NOVIDEO)

    let liveSession: VideoLiveSessionModel
    try {
      liveSession = await this.saveStartingSession(videoLive)
    } catch (err) {
      logger.error('Cannot save starting live session.', { err })

      this.videoSessions.delete(videoUUID)
      return this.abortSession(sessionId)
    }

    LiveQuotaStore.Instance.addNewLive(user.id, sessionId)

    const muxingSession = new MuxingSession({
      context: this.getContext(),
      sessionId,
      videoLive,
      user,

      ...pick(options, [
        'inputLocalUrl',
        'inputPublicUrl',
        'inputResolution',
        'bitrate',
        'ratio',
        'fps',
        'allResolutions',
        'hasAudio',
        'hasVideo',
        'probe'
      ])
    })

    // Track the cleanup from the session creation: a new session must not write in the live directory before this one flushed its files
    this.sessionCleanups.set(videoUUID, { sessionId, cleanup: muxingSession.waitForCleanup() })

    muxingSession.on('live-ready', () => this.publishAndFederateLive({ live: videoLive, ratio, audioOnlyOutput }))

    const safeStopSession = (error: LiveVideoErrorType) => {
      this.stopSessionOfVideo({ videoUUID, error })
        .catch(err => logger.error('Cannot stop session of video ' + videoUUID, { err }))
    }

    muxingSession.on('bad-socket-health', ({ videoUUID }) => {
      logger.error(
        'Too much data in client socket stream (ffmpeg is too slow to transcode the video).' +
          ' Stopping session of video %s.',
        videoUUID
      )

      safeStopSession(LiveVideoError.BAD_SOCKET_HEALTH)
    })

    muxingSession.on('duration-exceeded', ({ videoUUID }) => {
      logger.info('Stopping session of %s: max duration exceeded.', videoUUID)

      safeStopSession(LiveVideoError.DURATION_EXCEEDED)
    })

    muxingSession.on('quota-exceeded', ({ videoUUID }) => {
      logger.info('Stopping session of %s: user quota exceeded.', videoUUID)

      safeStopSession(LiveVideoError.QUOTA_EXCEEDED)
    })

    muxingSession.on('transcoding-error', () => {
      safeStopSession(LiveVideoError.FFMPEG_ERROR)
    })

    muxingSession.on('transcoding-end', ({ videoUUID }) => {
      this.onMuxingFFmpegEnd(videoUUID, sessionId)
    })

    muxingSession.on('after-cleanup', ({ videoUUID }) => {
      this.muxingSessions.delete(sessionId)
      this.deleteSessionCleanup(videoUUID, sessionId)

      LiveQuotaStore.Instance.removeLive(user.id, sessionId)

      muxingSession.destroy()

      return this.onAfterMuxingCleanup({ videoUUID, liveSessionId: liveSession.id })
        .catch(err => logger.error('Error in end transmuxing.', { err }))
    })

    this.muxingSessions.set(sessionId, muxingSession)

    muxingSession.runMuxing()
      .catch(err => {
        logger.error('Cannot run muxing.', { err })

        this.muxingSessions.delete(sessionId)
        this.deleteSessionCleanup(videoUUID, sessionId)

        LiveQuotaStore.Instance.removeLive(user.id, sessionId)

        // Resolves the cleanup promise, so a new session of this permanent live is not blocked
        muxingSession.destroy()

        this.stopSessionOfVideo({
          videoUUID,
          error: err.liveVideoErrorCode || LiveVideoError.UNKNOWN_ERROR,
          errorOnReplay: true // Replay cannot be processed as muxing session failed directly
        }).catch(stopErr => logger.error('Cannot stop session of video %s.', videoUUID, { err: stopErr }))
      })
  }

  private async publishAndFederateLive (options: {
    live: MVideoLiveVideo
    audioOnlyOutput: boolean
    ratio: number
  }) {
    const { live, ratio, audioOnlyOutput } = options

    const videoId = live.videoId

    try {
      const video = await VideoModel.loadFull(videoId)

      logger.info('Will publish and federate live %s.', video.url)

      video.state = VideoState.PUBLISHED

      const now = new Date()
      video.publishedAt = now

      video.aspectRatio = audioOnlyOutput
        ? 0
        : ratio

      await video.save()

      live.Video = video

      await wait(getLiveSegmentTime(live.latencyMode) * 1000 * VIDEO_LIVE.EDGE_LIVE_DELAY_SEGMENTS_NOTIFICATION)

      scheduleVideoFederation({ video })

      Notifier.Instance.notifyOnNewVideoOrLiveIfNeeded(video)
      PeerTubeSocket.Instance.sendVideoLiveNewState(video)

      Hooks.runAction('action:live.video.state.updated', { video })
    } catch (err) {
      logger.error('Cannot save/federate live video %d.', videoId, { err })
    }
  }

  private onMuxingFFmpegEnd (videoUUID: string, sessionId: string) {
    // Session already cleaned up, or a more recent session of this permanent live already registered itself:
    // the transcoding process of an ending session can exit long after the next one started
    if (this.videoSessions.get(videoUUID) !== sessionId) return

    this.videoSessions.delete(videoUUID)

    this.saveEndingSession({ videoUUID, error: null })
      .catch(err => logger.error('Cannot save ending session.', { err }))
  }

  private async onAfterMuxingCleanup (options: {
    videoUUID: string
    liveSessionId?: number
    cleanupNow?: boolean // Default false
  }) {
    const { videoUUID, liveSessionId, cleanupNow = false } = options

    logger.debug('Live of video %s has been cleaned up. Moving to its next state.', videoUUID)

    try {
      const fullVideo = await VideoModel.loadFull(videoUUID)
      if (!fullVideo) return

      const live = await VideoLiveModel.loadByVideoId(fullVideo.id)

      // Always reload from DB instead of reusing a caller-held instance to prevent concurrency issues
      const liveSession = liveSessionId
        ? await VideoLiveSessionModel.load(liveSessionId)
        : await VideoLiveSessionModel.findLatestSessionOf(fullVideo.id)

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

      scheduleVideoFederation({ video: fullVideo })

      Hooks.runAction('action:live.video.state.updated', { video: fullVideo })
    } catch (err) {
      logger.error('Cannot save/federate new video state of live streaming of video %s.', videoUUID, { err })
    }
  }

  private async handleBrokenLives () {
    await RunnerJobModel.cancelAllNonFinishedJobs({ type: 'live-rtmp-hls-transcoding' })

    const videoUUIDs = await VideoModel.listPublishedLiveUUIDs()

    for (const uuid of videoUUIDs) {
      await logger.withContext([ uuid ], async () => {
        await this.onAfterMuxingCleanup({ videoUUID: uuid, cleanupNow: true })
      })
    }
  }

  private async findReplayDirectory (video: MVideo) {
    const directory = getLiveReplayBaseDirectory(video)
    if (!(await pathExists(directory))) return undefined

    const files = await readdir(directory)

    if (files.length === 0) return undefined

    return files.sort().reverse()[0]
  }

  private buildAllResolutionsToTranscode (originResolution: number, hasAudio: boolean) {
    if (!CONFIG.LIVE.TRANSCODING.ENABLED) return [ originResolution ]

    const includeInput = CONFIG.LIVE.TRANSCODING.ALWAYS_TRANSCODE_ORIGINAL_RESOLUTION

    const resolutionsEnabled = computeResolutionsToTranscode({
      input: originResolution,
      type: 'live',
      includeInput,
      strictLower: false,
      hasAudio
    })

    if (hasAudio && resolutionsEnabled.length !== 0 && !resolutionsEnabled.includes(VideoResolution.H_NOVIDEO)) {
      resolutionsEnabled.push(VideoResolution.H_NOVIDEO)
    }

    if (resolutionsEnabled.length === 0) return [ originResolution ]

    return resolutionsEnabled
  }

  private saveStartingSession (videoLive: MVideoLiveVideoWithSetting) {
    const replaySettings = videoLive.saveReplay
      ? new VideoLiveReplaySettingModel({
        privacy: videoLive.ReplaySetting.privacy
      })
      : null

    return retryTransactionWrapper(() => {
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
    })
  }

  private async saveEndingSession (options: {
    videoUUID: string
    error: LiveVideoErrorType | null
    errorOnReplay?: boolean
  }) {
    const { videoUUID, error, errorOnReplay } = options

    const liveSession = await VideoLiveSessionModel.findCurrentSessionOf(videoUUID)
    if (!liveSession) return

    liveSession.endDate = new Date()
    liveSession.error = error

    if (errorOnReplay === true) {
      liveSession.endingProcessed = true
    }

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
