
import { AsyncQueue, queue } from 'async'
import * as chokidar from 'chokidar'
import { FfmpegCommand } from 'fluent-ffmpeg'
import { ensureDir, readdir, remove } from 'fs-extra'
import { basename, join } from 'path'
import { computeResolutionsToTranscode, runLiveMuxing, runLiveTranscoding } from '@server/helpers/ffmpeg-utils'
import { logger } from '@server/helpers/logger'
import { CONFIG, registerConfigChangedHandler } from '@server/initializers/config'
import { P2P_MEDIA_LOADER_PEER_VERSION, VIDEO_LIVE, WEBSERVER } from '@server/initializers/constants'
import { VideoFileModel } from '@server/models/video/video-file'
import { VideoLiveModel } from '@server/models/video/video-live'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist'
import { MStreamingPlaylist, MVideo, MVideoLiveVideo } from '@server/types/models'
import { VideoState, VideoStreamingPlaylistType } from '@shared/models'
import { buildSha256Segment } from './hls'
import { getHLSDirectory } from './video-paths'

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
  private readonly segmentsSha256 = new Map<string, Map<string, string>>()

  private segmentsSha256Queue: AsyncQueue<SegmentSha256QueueParam>
  private rtmpServer: any

  private constructor () {
  }

  init () {
    this.getContext().nodeEvent.on('postPublish', (sessionId: string, streamPath: string) => {
      logger.debug('RTMP received stream', { id: sessionId, streamPath })

      const splittedPath = streamPath.split('/')
      if (splittedPath.length !== 3 || splittedPath[1] !== VIDEO_LIVE.RTMP.BASE_PATH) {
        logger.warn('Live path is incorrect.', { streamPath })
        return this.abortSession(sessionId)
      }

      this.handleSession(sessionId, streamPath, splittedPath[2])
        .catch(err => logger.error('Cannot handle sessions.', { err }))
    })

    this.getContext().nodeEvent.on('donePublish', sessionId => {
      this.abortSession(sessionId)
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
    logger.info('Running RTMP server.')

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

  private getContext () {
    return context
  }

  private abortSession (id: string) {
    const session = this.getContext().sessions.get(id)
    if (session) session.stop()

    const transSession = this.transSessions.get(id)
    if (transSession) transSession.kill('SIGKILL')
  }

  private async handleSession (sessionId: string, streamPath: string, streamKey: string) {
    const videoLive = await VideoLiveModel.loadByStreamKey(streamKey)
    if (!videoLive) {
      logger.warn('Unknown live video with stream key %s.', streamKey)
      return this.abortSession(sessionId)
    }

    const video = videoLive.Video
    const playlistUrl = WEBSERVER.URL + VideoStreamingPlaylistModel.getHlsMasterPlaylistStaticPath(video.uuid)

    const session = this.getContext().sessions.get(sessionId)
    const resolutionsEnabled = CONFIG.LIVE.TRANSCODING.ENABLED
      ? computeResolutionsToTranscode(session.videoHeight, 'live')
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

    video.state = VideoState.PUBLISHED
    await video.save()

    // FIXME: federation?

    return this.runMuxing({
      sessionId,
      videoLive,
      playlist: videoStreamingPlaylist,
      streamPath,
      originalResolution: session.videoHeight,
      resolutionsEnabled
    })
  }

  private async runMuxing (options: {
    sessionId: string
    videoLive: MVideoLiveVideo
    playlist: MStreamingPlaylist
    streamPath: string
    resolutionsEnabled: number[]
    originalResolution: number
  }) {
    const { sessionId, videoLive, playlist, streamPath, resolutionsEnabled, originalResolution } = options
    const allResolutions = resolutionsEnabled.concat([ originalResolution ])

    for (let i = 0; i < allResolutions.length; i++) {
      const resolution = allResolutions[i]

      VideoFileModel.upsert({
        resolution,
        size: -1,
        extname: '.ts',
        infoHash: null,
        fps: -1,
        videoStreamingPlaylistId: playlist.id
      }).catch(err => {
        logger.error('Cannot create file for live streaming.', { err })
      })
    }

    const outPath = getHLSDirectory(videoLive.Video)
    await ensureDir(outPath)

    const rtmpUrl = 'rtmp://127.0.0.1:' + config.rtmp.port + streamPath
    const ffmpegExec = CONFIG.LIVE.TRANSCODING.ENABLED
      ? runLiveTranscoding(rtmpUrl, outPath, allResolutions)
      : runLiveMuxing(rtmpUrl, outPath)

    logger.info('Running live muxing/transcoding.')

    this.transSessions.set(sessionId, ffmpegExec)

    const onFFmpegEnded = () => {
      watcher.close()
        .catch(err => logger.error('Cannot close watcher of %s.', outPath, { err }))

      this.onEndTransmuxing(videoLive.Video, playlist, streamPath, outPath)
        .catch(err => logger.error('Error in closed transmuxing.', { err }))
    }

    ffmpegExec.on('error', (err, stdout, stderr) => {
      onFFmpegEnded()

      // Don't care that we killed the ffmpeg process
      if (err?.message?.includes('SIGKILL')) return

      logger.error('Live transcoding error.', { err, stdout, stderr })
    })

    ffmpegExec.on('end', () => onFFmpegEnded())

    const videoUUID = videoLive.Video.uuid
    const watcher = chokidar.watch(outPath + '/*.ts')

    const updateHandler = segmentPath => this.segmentsSha256Queue.push({ operation: 'update', segmentPath, videoUUID })
    const deleteHandler = segmentPath => this.segmentsSha256Queue.push({ operation: 'delete', segmentPath, videoUUID })

    watcher.on('add', p => updateHandler(p))
    watcher.on('change', p => updateHandler(p))
    watcher.on('unlink', p => deleteHandler(p))
  }

  private async onEndTransmuxing (video: MVideo, playlist: MStreamingPlaylist, streamPath: string, outPath: string) {
    logger.info('RTMP transmuxing for %s ended.', streamPath)

    const files = await readdir(outPath)

    for (const filename of files) {
      if (
        filename.endsWith('.ts') ||
        filename.endsWith('.m3u8') ||
        filename.endsWith('.mpd') ||
        filename.endsWith('.m4s') ||
        filename.endsWith('.tmp')
      ) {
        const p = join(outPath, filename)

        remove(p)
          .catch(err => logger.error('Cannot remove %s.', p, { err }))
      }
    }

    playlist.destroy()
      .catch(err => logger.error('Cannot remove live streaming playlist.', { err }))

    video.state = VideoState.LIVE_ENDED
    video.save()
      .catch(err => logger.error('Cannot save new video state of live streaming.', { err }))
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

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  LiveManager
}
