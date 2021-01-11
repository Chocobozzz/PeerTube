
import * as Bluebird from 'bluebird'
import * as chokidar from 'chokidar'
import { FfmpegCommand } from 'fluent-ffmpeg'
import { appendFile, ensureDir, readFile, stat } from 'fs-extra'
import { basename, join } from 'path'
import { isTestInstance } from '@server/helpers/core-utils'
import { getLiveMuxingCommand, getLiveTranscodingCommand } from '@server/helpers/ffmpeg-utils'
import { computeResolutionsToTranscode, getVideoFileFPS, getVideoFileResolution } from '@server/helpers/ffprobe-utils'
import { logger } from '@server/helpers/logger'
import { CONFIG, registerConfigChangedHandler } from '@server/initializers/config'
import { MEMOIZE_TTL, P2P_MEDIA_LOADER_PEER_VERSION, VIDEO_LIVE, VIEW_LIFETIME, WEBSERVER } from '@server/initializers/constants'
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
import { cleanupLive } from './job-queue/handlers/video-live-ending'
import { PeerTubeSocket } from './peertube-socket'
import { isAbleToUploadVideo } from './user'
import { getHLSDirectory } from './video-paths'
import { availableEncoders } from './video-transcoding-profiles'

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

class LiveManager {

  private static instance: LiveManager

  private readonly transSessions = new Map<string, FfmpegCommand>()
  private readonly videoSessions = new Map<number, string>()
  // Values are Date().getTime()
  private readonly watchersPerVideo = new Map<number, number[]>()
  private readonly segmentsSha256 = new Map<string, Map<string, string>>()
  private readonly livesPerUser = new Map<number, { liveId: number, videoId: number, size: number }[]>()

  private readonly isAbleToUploadVideoWithCache = memoizee((userId: number) => {
    return isAbleToUploadVideo(userId, 1000)
  }, { maxAge: MEMOIZE_TTL.LIVE_ABLE_TO_UPLOAD })

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

    registerConfigChangedHandler(() => {
      if (!this.rtmpServer && CONFIG.LIVE.ENABLED === true) {
        this.run()
        return
      }

      if (this.rtmpServer && CONFIG.LIVE.ENABLED === false) {
        this.stop()
      }
    })

    // Cleanup broken lives, that were terminated by a server restart for example
    this.handleBrokenLives()
      .catch(err => logger.error('Cannot handle broken lives.', { err }))

    setInterval(() => this.updateLiveViews(), VIEW_LIFETIME.LIVE)
  }

  run () {
    logger.info('Running RTMP server on port %d', config.rtmp.port)

    this.rtmpServer = new NodeRtmpServer(config)
    this.rtmpServer.tcpServer.on('error', err => {
      logger.error('Cannot run RTMP server.', { err })
    })

    this.rtmpServer.run()
  }

  stop () {
    logger.info('Stopping RTMP server.')

    this.rtmpServer.stop()
    this.rtmpServer = undefined
  }

  isRunning () {
    return !!this.rtmpServer
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

  addViewTo (videoId: number) {
    if (this.videoSessions.has(videoId) === false) return

    let watchers = this.watchersPerVideo.get(videoId)

    if (!watchers) {
      watchers = []
      this.watchersPerVideo.set(videoId, watchers)
    }

    watchers.push(new Date().getTime())
  }

  cleanupShaSegments (videoUUID: string) {
    this.segmentsSha256.delete(videoUUID)
  }

  addSegmentToReplay (hlsVideoPath: string, segmentPath: string) {
    const segmentName = basename(segmentPath)
    const dest = join(hlsVideoPath, VIDEO_LIVE.REPLAY_DIRECTORY, this.buildConcatenatedName(segmentName))

    return readFile(segmentPath)
      .then(data => appendFile(dest, data))
      .catch(err => logger.error('Cannot copy segment %s to repay directory.', segmentPath, { err }))
  }

  buildConcatenatedName (segmentOrPlaylistPath: string) {
    const num = basename(segmentOrPlaylistPath).match(/^(\d+)(-|\.)/)

    return 'concat-' + num[1] + '.ts'
  }

  private processSegments (hlsVideoPath: string, videoUUID: string, videoLive: MVideoLive, segmentPaths: string[]) {
    Bluebird.mapSeries(segmentPaths, async previousSegment => {
      // Add sha hash of previous segments, because ffmpeg should have finished generating them
      await this.addSegmentSha(videoUUID, previousSegment)

      if (videoLive.saveReplay) {
        await this.addSegmentToReplay(hlsVideoPath, previousSegment)
      }
    }).catch(err => logger.error('Cannot process segments in %s', hlsVideoPath, { err }))
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

    // Cleanup old potential live files (could happen with a permanent live)
    this.cleanupShaSegments(video.uuid)

    const oldStreamingPlaylist = await VideoStreamingPlaylistModel.loadHLSPlaylistByVideo(video.id)
    if (oldStreamingPlaylist) {
      await cleanupLive(video, oldStreamingPlaylist)
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

    const allResolutions = resolutionsEnabled.concat([ session.videoHeight ])

    logger.info('Will mux/transcode live video of original resolution %d.', session.videoHeight, { allResolutions })

    const [ videoStreamingPlaylist ] = await VideoStreamingPlaylistModel.upsert({
      videoId: video.id,
      playlistUrl,
      segmentsSha256Url: WEBSERVER.URL + VideoStreamingPlaylistModel.getHlsSha256SegmentsStaticPath(video.uuid, video.isLive),
      p2pMediaLoaderInfohashes: VideoStreamingPlaylistModel.buildP2PMediaLoaderInfoHashes(playlistUrl, allResolutions),
      p2pMediaLoaderPeerVersion: P2P_MEDIA_LOADER_PEER_VERSION,

      type: VideoStreamingPlaylistType.HLS
    }, { returning: true }) as [ MStreamingPlaylist, boolean ]

    return this.runMuxing({
      sessionId,
      videoLive,
      playlist: videoStreamingPlaylist,
      rtmpUrl,
      fps,
      allResolutions
    })
  }

  private async runMuxing (options: {
    sessionId: string
    videoLive: MVideoLiveVideo
    playlist: MStreamingPlaylist
    rtmpUrl: string
    fps: number
    allResolutions: number[]
  }) {
    const { sessionId, videoLive, playlist, allResolutions, fps, rtmpUrl } = options
    const startStreamDateTime = new Date().getTime()

    const user = await UserModel.loadByLiveId(videoLive.id)
    if (!this.livesPerUser.has(user.id)) {
      this.livesPerUser.set(user.id, [])
    }

    const currentUserLive = { liveId: videoLive.id, videoId: videoLive.videoId, size: 0 }
    const livesOfUser = this.livesPerUser.get(user.id)
    livesOfUser.push(currentUserLive)

    for (let i = 0; i < allResolutions.length; i++) {
      const resolution = allResolutions[i]

      const file = new VideoFileModel({
        resolution,
        size: -1,
        extname: '.ts',
        infoHash: null,
        fps,
        videoStreamingPlaylistId: playlist.id
      })

      VideoFileModel.customUpsert(file, 'streaming-playlist', null)
        .catch(err => logger.error('Cannot create file for live streaming.', { err }))
    }

    const outPath = getHLSDirectory(videoLive.Video)
    await ensureDir(outPath)

    const replayDirectory = join(outPath, VIDEO_LIVE.REPLAY_DIRECTORY)

    if (videoLive.saveReplay === true) {
      await ensureDir(replayDirectory)
    }

    const videoUUID = videoLive.Video.uuid

    const ffmpegExec = CONFIG.LIVE.TRANSCODING.ENABLED
      ? await getLiveTranscodingCommand({
        rtmpUrl,
        outPath,
        resolutions: allResolutions,
        fps,
        availableEncoders,
        profile: 'default'
      })
      : getLiveMuxingCommand(rtmpUrl, outPath)

    logger.info('Running live muxing/transcoding for %s.', videoUUID)
    this.transSessions.set(sessionId, ffmpegExec)

    const tsWatcher = chokidar.watch(outPath + '/*.ts')

    const segmentsToProcessPerPlaylist: { [playlistId: string]: string[] } = {}
    const playlistIdMatcher = /^([\d+])-/

    const addHandler = segmentPath => {
      logger.debug('Live add handler of %s.', segmentPath)

      const playlistId = basename(segmentPath).match(playlistIdMatcher)[0]

      const segmentsToProcess = segmentsToProcessPerPlaylist[playlistId] || []
      this.processSegments(outPath, videoUUID, videoLive, segmentsToProcess)

      segmentsToProcessPerPlaylist[playlistId] = [ segmentPath ]

      // Duration constraint check
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

    const deleteHandler = segmentPath => this.removeSegmentSha(videoUUID, segmentPath)

    tsWatcher.on('add', p => addHandler(p))
    tsWatcher.on('unlink', p => deleteHandler(p))

    const masterWatcher = chokidar.watch(outPath + '/master.m3u8')
    masterWatcher.on('add', async () => {
      try {
        const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(videoLive.videoId)

        video.state = VideoState.PUBLISHED
        await video.save()
        videoLive.Video = video

        setTimeout(() => {
          federateVideoIfNeeded(video, false)
            .catch(err => logger.error('Cannot federate live video %s.', video.url, { err }))

          PeerTubeSocket.Instance.sendVideoLiveNewState(video)
        }, VIDEO_LIVE.SEGMENT_TIME_SECONDS * 1000 * VIDEO_LIVE.EDGE_LIVE_DELAY_SEGMENTS_NOTIFICATION)

      } catch (err) {
        logger.error('Cannot save/federate live video %d.', videoLive.videoId, { err })
      } finally {
        masterWatcher.close()
          .catch(err => logger.error('Cannot close master watcher of %s.', outPath, { err }))
      }
    })

    const onFFmpegEnded = () => {
      logger.info('RTMP transmuxing for video %s ended. Scheduling cleanup', rtmpUrl)

      this.transSessions.delete(sessionId)

      this.watchersPerVideo.delete(videoLive.videoId)
      this.videoSessions.delete(videoLive.videoId)

      const newLivesPerUser = this.livesPerUser.get(user.id)
                                               .filter(o => o.liveId !== videoLive.id)
      this.livesPerUser.set(user.id, newLivesPerUser)

      setTimeout(() => {
        // Wait latest segments generation, and close watchers

        Promise.all([ tsWatcher.close(), masterWatcher.close() ])
          .then(() => {
            // Process remaining segments hash
            for (const key of Object.keys(segmentsToProcessPerPlaylist)) {
              this.processSegments(outPath, videoUUID, videoLive, segmentsToProcessPerPlaylist[key])
            }
          })
          .catch(err => logger.error('Cannot close watchers of %s or process remaining hash segments.', outPath, { err }))

        this.onEndTransmuxing(videoLive.Video.id)
          .catch(err => logger.error('Error in closed transmuxing.', { err }))
      }, 1000)
    }

    ffmpegExec.on('error', (err, stdout, stderr) => {
      onFFmpegEnded()

      // Don't care that we killed the ffmpeg process
      if (err?.message?.includes('Exiting normally')) return

      logger.error('Live transcoding error.', { err, stdout, stderr })

      this.abortSession(sessionId)
    })

    ffmpegExec.on('end', () => onFFmpegEnded())

    ffmpegExec.run()
  }

  private async onEndTransmuxing (videoId: number, cleanupNow = false) {
    try {
      const fullVideo = await VideoModel.loadAndPopulateAccountAndServerAndTags(videoId)
      if (!fullVideo) return

      const live = await VideoLiveModel.loadByVideoId(videoId)

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
      logger.error('Cannot save/federate new video state of live streaming.', { err })
    }
  }

  private async addSegmentSha (videoUUID: string, segmentPath: string) {
    const segmentName = basename(segmentPath)
    logger.debug('Adding live sha segment %s.', segmentPath)

    const shaResult = await buildSha256Segment(segmentPath)

    if (!this.segmentsSha256.has(videoUUID)) {
      this.segmentsSha256.set(videoUUID, new Map())
    }

    const filesMap = this.segmentsSha256.get(videoUUID)
    filesMap.set(segmentName, shaResult)
  }

  private removeSegmentSha (videoUUID: string, segmentPath: string) {
    const segmentName = basename(segmentPath)

    logger.debug('Removing live sha segment %s.', segmentPath)

    const filesMap = this.segmentsSha256.get(videoUUID)
    if (!filesMap) {
      logger.warn('Unknown files map to remove sha for %s.', videoUUID)
      return
    }

    if (!filesMap.has(segmentName)) {
      logger.warn('Unknown segment in files map for video %s and segment %s.', videoUUID, segmentPath)
      return
    }

    filesMap.delete(segmentName)
  }

  private isDurationConstraintValid (streamingStartTime: number) {
    const maxDuration = CONFIG.LIVE.MAX_DURATION
    // No limit
    if (maxDuration < 0) return true

    const now = new Date().getTime()
    const max = streamingStartTime + maxDuration

    return now <= max
  }

  private async isQuotaConstraintValid (user: MUserId, live: MVideoLive) {
    if (live.saveReplay !== true) return true

    return this.isAbleToUploadVideoWithCache(user.id)
  }

  private async updateLiveViews () {
    if (!this.isRunning()) return

    if (!isTestInstance()) logger.info('Updating live video views.')

    for (const videoId of this.watchersPerVideo.keys()) {
      const notBefore = new Date().getTime() - VIEW_LIFETIME.LIVE

      const watchers = this.watchersPerVideo.get(videoId)

      const numWatchers = watchers.length

      const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(videoId)
      video.views = numWatchers
      await video.save()

      await federateVideoIfNeeded(video, false)

      PeerTubeSocket.Instance.sendVideoViewsUpdate(video)

      // Only keep not expired watchers
      const newWatchers = watchers.filter(w => w > notBefore)
      this.watchersPerVideo.set(videoId, newWatchers)

      logger.debug('New live video views for %s is %d.', video.url, numWatchers)
    }
  }

  private async handleBrokenLives () {
    const videoIds = await VideoModel.listPublishedLiveIds()

    for (const id of videoIds) {
      await this.onEndTransmuxing(id, true)
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  LiveManager
}
