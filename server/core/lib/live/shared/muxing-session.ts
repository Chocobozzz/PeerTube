import { wait } from '@peertube/peertube-core-utils'
import {
  FileStorage,
  LiveVideoError,
  VideoFileFormatFlag,
  VideoFileStream,
  VideoResolution,
  VideoStreamingPlaylistType
} from '@peertube/peertube-models'
import { computeOutputFPS } from '@server/helpers/ffmpeg/index.js'
import { LoggerTagsFn, logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { MEMOIZE_TTL, P2P_MEDIA_LOADER_PEER_VERSION, VIDEO_LIVE } from '@server/initializers/constants.js'
import { removeHLSFileObjectStorageByPath, storeHLSFileFromContent, storeHLSFileFromPath } from '@server/lib/object-storage/index.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist.js'
import { MStreamingPlaylistVideo, MUserId, MVideoLiveVideo } from '@server/types/models/index.js'
import Bluebird from 'bluebird'
import { FSWatcher, watch } from 'chokidar'
import { EventEmitter } from 'events'
import { FfprobeData } from 'fluent-ffmpeg'
import { ensureDir } from 'fs-extra/esm'
import { appendFile, readFile, stat } from 'fs/promises'
import memoizee from 'memoizee'
import PQueue from 'p-queue'
import { basename, join } from 'path'
import {
  generateHLSMasterPlaylistFilename,
  generateHlsSha256SegmentsFilename,
  getLiveDirectory,
  getLiveReplayBaseDirectory
} from '../../paths.js'
import { isUserQuotaValid } from '../../user.js'
import { LiveQuotaStore } from '../live-quota-store.js'
import { LiveSegmentShaStore } from '../live-segment-sha-store.js'
import { buildConcatenatedName, getLiveSegmentTime } from '../live-utils.js'
import { AbstractTranscodingWrapper, FFmpegTranscodingWrapper, RemoteTranscodingWrapper } from './transcoding-wrapper/index.js'

interface MuxingSessionEvents {
  'live-ready': (options: { videoUUID: string }) => void

  'bad-socket-health': (options: { videoUUID: string }) => void
  'duration-exceeded': (options: { videoUUID: string }) => void
  'quota-exceeded': (options: { videoUUID: string }) => void

  'transcoding-end': (options: { videoUUID: string }) => void
  'transcoding-error': (options: { videoUUID: string }) => void

  'after-cleanup': (options: { videoUUID: string }) => void
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

  private transcodingWrapper: AbstractTranscodingWrapper

  private readonly context: any
  private readonly user: MUserId
  private readonly sessionId: string
  private readonly videoLive: MVideoLiveVideo

  private readonly inputLocalUrl: string
  private readonly inputPublicUrl: string

  private readonly fps: number

  private readonly inputResolution: number
  private readonly allResolutions: number[]

  private readonly bitrate: number
  private readonly ratio: number

  private readonly hasAudio: boolean
  private readonly hasVideo: boolean

  private readonly probe: FfprobeData

  private readonly videoUUID: string
  private readonly saveReplay: boolean

  private readonly outDirectory: string
  private readonly replayDirectory: string

  private readonly lTags: LoggerTagsFn

  // Path -> Queue
  private readonly objectStorageSendQueues = new Map<string, PQueue>()

  private segmentsToProcessPerPlaylist: { [playlistId: string]: string[] } = {}

  private streamingPlaylist: MStreamingPlaylistVideo
  private liveSegmentShaStore: LiveSegmentShaStore

  private filesWatcher: FSWatcher

  private masterPlaylistCreated = false
  private liveReady = false

  private aborted = false

  private readonly isAbleToUploadVideoWithCache = memoizee((userId: number) => {
    return isUserQuotaValid({ userId, uploadSize: 1000 })
  }, { maxAge: MEMOIZE_TTL.LIVE_ABLE_TO_UPLOAD })

  private readonly hasClientSocketInBadHealthWithCache = memoizee((sessionId: string) => {
    return this.hasClientSocketInBadHealth(sessionId)
  }, { maxAge: MEMOIZE_TTL.LIVE_CHECK_SOCKET_HEALTH })

  constructor (options: {
    context: any
    user: MUserId
    sessionId: string
    videoLive: MVideoLiveVideo

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
    super()

    this.context = options.context
    this.user = options.user
    this.sessionId = options.sessionId
    this.videoLive = options.videoLive

    this.inputLocalUrl = options.inputLocalUrl
    this.inputPublicUrl = options.inputPublicUrl

    this.fps = options.fps

    this.bitrate = options.bitrate
    this.ratio = options.ratio
    this.probe = options.probe

    this.hasVideo = options.hasVideo
    this.hasAudio = options.hasAudio

    this.inputResolution = options.inputResolution
    this.allResolutions = options.allResolutions

    this.videoUUID = this.videoLive.Video.uuid

    this.saveReplay = this.videoLive.saveReplay

    this.outDirectory = getLiveDirectory(this.videoLive.Video)
    this.replayDirectory = join(getLiveReplayBaseDirectory(this.videoLive.Video), new Date().toISOString())

    this.lTags = loggerTagsFactory('live', this.sessionId, this.videoUUID)
  }

  async runMuxing () {
    this.streamingPlaylist = await this.createLivePlaylist()

    const toTranscode = this.buildToTranscode()

    this.createLiveShaStore()
    this.createFiles(toTranscode)

    await this.prepareDirectories()

    this.transcodingWrapper = this.buildTranscodingWrapper(toTranscode)

    this.transcodingWrapper.on('end', () => this.onTranscodedEnded())
    this.transcodingWrapper.on('error', () => this.onTranscodingError())

    await this.transcodingWrapper.run()

    this.filesWatcher = watch(this.outDirectory, { depth: 0 })

    this.watchMasterFile()
    this.watchTSFiles()
  }

  abort () {
    if (!this.transcodingWrapper) return

    this.aborted = true
    this.transcodingWrapper.abort()
  }

  destroy () {
    this.removeAllListeners()
    this.isAbleToUploadVideoWithCache.clear()
    this.hasClientSocketInBadHealthWithCache.clear()
  }

  private watchMasterFile () {
    this.filesWatcher.on('add', async path => {
      if (path !== join(this.outDirectory, this.streamingPlaylist.playlistFilename)) return
      if (this.masterPlaylistCreated === true) return

      try {
        if (this.streamingPlaylist.storage === FileStorage.OBJECT_STORAGE) {
          let masterContent = await readFile(path, 'utf-8')

          // If the disk sync is slow, don't upload an empty master playlist on object storage
          // Wait for ffmpeg to correctly fill it
          while (!masterContent) {
            await wait(100)

            masterContent = await readFile(path, 'utf-8')
          }

          logger.debug('Uploading live master playlist on object storage for %s', this.videoUUID, { masterContent, ...this.lTags() })

          const url = await storeHLSFileFromContent(this.streamingPlaylist, this.streamingPlaylist.playlistFilename, masterContent)

          this.streamingPlaylist.playlistUrl = url
        }

        this.streamingPlaylist.assignP2PMediaLoaderInfoHashes(this.videoLive.Video, this.allResolutions.map(r => ({ height: r })))

        await this.streamingPlaylist.save()
      } catch (err) {
        logger.error('Cannot update streaming playlist.', { err, ...this.lTags() })
      }

      this.masterPlaylistCreated = true

      logger.info('Master playlist file for %s has been created', this.videoUUID, this.lTags())
    })
  }

  private watchTSFiles () {
    const startStreamDateTime = new Date().getTime()

    const addHandler = async (segmentPath: string) => {
      if (segmentPath.endsWith('.ts') !== true) return

      logger.debug('Live add handler of TS file %s.', segmentPath, this.lTags())

      const playlistId = this.getPlaylistIdFromTS(segmentPath)

      const segmentsToProcess = this.segmentsToProcessPerPlaylist[playlistId] || []
      this.processSegments(segmentsToProcess)

      this.segmentsToProcessPerPlaylist[playlistId] = [ segmentPath ]

      if (this.hasClientSocketInBadHealthWithCache(this.sessionId)) {
        this.emit('bad-socket-health', { videoUUID: this.videoUUID })
        return
      }

      // Duration constraint check
      if (this.isDurationConstraintValid(startStreamDateTime) !== true) {
        this.emit('duration-exceeded', { videoUUID: this.videoUUID })
        return
      }

      // Check user quota if the user enabled replay saving
      if (await this.isQuotaExceeded(segmentPath) === true) {
        this.emit('quota-exceeded', { videoUUID: this.videoUUID })
      }
    }

    const deleteHandler = async (segmentPath: string) => {
      if (segmentPath.endsWith('.ts') !== true) return

      logger.debug('Live delete handler of TS file %s.', segmentPath, this.lTags())

      try {
        await this.liveSegmentShaStore.removeSegmentSha(segmentPath)
      } catch (err) {
        logger.warn('Cannot remove segment sha %s from sha store', segmentPath, { err, ...this.lTags() })
      }

      if (this.streamingPlaylist.storage === FileStorage.OBJECT_STORAGE) {
        try {
          await removeHLSFileObjectStorageByPath(this.streamingPlaylist, segmentPath)
        } catch (err) {
          logger.error('Cannot remove segment %s from object storage', segmentPath, { err, ...this.lTags() })
        }
      }
    }

    this.filesWatcher.on('add', p => addHandler(p))
    this.filesWatcher.on('unlink', p => deleteHandler(p))
  }

  private async isQuotaExceeded (segmentPath: string) {
    if (this.saveReplay !== true) return false
    if (this.aborted) return false

    try {
      const segmentStat = await stat(segmentPath)

      LiveQuotaStore.Instance.addQuotaTo(this.user.id, this.sessionId, segmentStat.size)

      const canUpload = await this.isAbleToUploadVideoWithCache(this.user.id)

      return canUpload !== true
    } catch (err) {
      logger.error('Cannot stat %s or check quota of %d.', segmentPath, this.user.id, { err, ...this.lTags() })
    }
  }

  private createFiles (toTranscode: { fps: number, resolution: number }[]) {
    for (const { resolution, fps } of toTranscode) {
      const file = new VideoFileModel({
        resolution,
        fps,
        size: -1,
        extname: '.ts',
        infoHash: null,
        formatFlags: VideoFileFormatFlag.NONE,
        streams: resolution === VideoResolution.H_NOVIDEO
          ? VideoFileStream.AUDIO
          : VideoFileStream.VIDEO,
        storage: this.streamingPlaylist.storage,
        videoStreamingPlaylistId: this.streamingPlaylist.id
      })

      VideoFileModel.customUpsert(file, 'streaming-playlist', null)
        .catch(err => logger.error('Cannot create file for live streaming.', { err, ...this.lTags() }))
    }
  }

  private async prepareDirectories () {
    await ensureDir(this.outDirectory)

    if (this.videoLive.saveReplay === true) {
      await ensureDir(this.replayDirectory)
    }
  }

  private isDurationConstraintValid (streamingStartTime: number) {
    const maxDuration = CONFIG.LIVE.MAX_DURATION
    // No limit
    if (maxDuration < 0) return true

    const now = new Date().getTime()
    const max = streamingStartTime + maxDuration

    return now <= max
  }

  private processSegments (segmentPaths: string[]) {
    Bluebird.mapSeries(segmentPaths, previousSegment => this.processSegment(previousSegment))
      .catch(err => {
        if (this.aborted) return

        logger.error('Cannot process segments', { err, ...this.lTags() })
      })
  }

  private async processSegment (segmentPath: string) {
    // Add sha hash of previous segments, because ffmpeg should have finished generating them
    await this.liveSegmentShaStore.addSegmentSha(segmentPath)

    if (this.saveReplay) {
      await this.addSegmentToReplay(segmentPath)
    }

    if (this.streamingPlaylist.storage === FileStorage.OBJECT_STORAGE) {
      try {
        await storeHLSFileFromPath(this.streamingPlaylist, segmentPath)

        await this.processM3U8ToObjectStorage(segmentPath)
      } catch (err) {
        logger.error('Cannot store TS segment %s in object storage', segmentPath, { err, ...this.lTags() })
      }
    }

    // Master playlist and segment JSON file are created, live is ready
    if (this.masterPlaylistCreated && !this.liveReady) {
      this.liveReady = true

      this.emit('live-ready', { videoUUID: this.videoUUID })
    }
  }

  private async processM3U8ToObjectStorage (segmentPath: string) {
    const m3u8Path = join(this.outDirectory, this.getPlaylistNameFromTS(segmentPath))

    logger.debug('Process M3U8 file %s.', m3u8Path, this.lTags())

    const segmentName = basename(segmentPath)

    const playlistContent = await readFile(m3u8Path, 'utf-8')
    // Remove new chunk references, that will be processed later
    const filteredPlaylistContent = playlistContent.substring(0, playlistContent.lastIndexOf(segmentName) + segmentName.length) + '\n'

    try {
      if (!this.objectStorageSendQueues.has(m3u8Path)) {
        this.objectStorageSendQueues.set(m3u8Path, new PQueue({ concurrency: 1 }))
      }

      const queue = this.objectStorageSendQueues.get(m3u8Path)
      await queue.add(() => storeHLSFileFromContent(this.streamingPlaylist, m3u8Path, filteredPlaylistContent))
    } catch (err) {
      logger.error('Cannot store in object storage m3u8 file %s', m3u8Path, { err, ...this.lTags() })
    }
  }

  private onTranscodingError () {
    this.emit('transcoding-error', ({ videoUUID: this.videoUUID }))
  }

  private onTranscodedEnded () {
    this.emit('transcoding-end', ({ videoUUID: this.videoUUID }))

    logger.info('RTMP transmuxing for video %s ended. Scheduling cleanup', this.inputLocalUrl, this.lTags())

    setTimeout(() => {
      // Wait latest segments generation, and close watchers

      const promise = this.filesWatcher?.close() || Promise.resolve()
      promise
        .then(() => {
          // Process remaining segments hash
          for (const key of Object.keys(this.segmentsToProcessPerPlaylist)) {
            this.processSegments(this.segmentsToProcessPerPlaylist[key])
          }
        })
        .catch(err => {
          logger.error(
            'Cannot close watchers of %s or process remaining hash segments.', this.outDirectory,
            { err, ...this.lTags() }
          )
        })

      this.emit('after-cleanup', { videoUUID: this.videoUUID })
    }, 1000)
  }

  private hasClientSocketInBadHealth (sessionId: string) {
    const rtmpSession = this.context.sessions.get(sessionId)

    if (!rtmpSession) {
      logger.warn('Cannot get session %s to check players socket health.', sessionId, this.lTags())
      return
    }

    for (const playerSessionId of rtmpSession.players) {
      const playerSession = this.context.sessions.get(playerSessionId)

      if (!playerSession) {
        logger.error('Cannot get player session %s to check socket health.', playerSession, this.lTags())
        continue
      }

      if (playerSession.socket.writableLength > VIDEO_LIVE.MAX_SOCKET_WAITING_DATA) {
        return true
      }
    }

    return false
  }

  private async addSegmentToReplay (segmentPath: string) {
    const segmentName = basename(segmentPath)
    const dest = join(this.replayDirectory, buildConcatenatedName(segmentName))

    try {
      const data = await readFile(segmentPath)

      await appendFile(dest, data)
    } catch (err) {
      logger.error('Cannot copy segment %s to replay directory.', segmentPath, { err, ...this.lTags() })
    }
  }

  private async createLivePlaylist (): Promise<MStreamingPlaylistVideo> {
    const playlist = await VideoStreamingPlaylistModel.loadOrGenerate(this.videoLive.Video)

    playlist.playlistFilename = generateHLSMasterPlaylistFilename(true)
    playlist.segmentsSha256Filename = generateHlsSha256SegmentsFilename(true)

    playlist.p2pMediaLoaderPeerVersion = P2P_MEDIA_LOADER_PEER_VERSION
    playlist.type = VideoStreamingPlaylistType.HLS

    playlist.storage = CONFIG.OBJECT_STORAGE.ENABLED && CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS.STORE_LIVE_STREAMS
      ? FileStorage.OBJECT_STORAGE
      : FileStorage.FILE_SYSTEM

    return playlist.save()
  }

  private createLiveShaStore () {
    this.liveSegmentShaStore = new LiveSegmentShaStore({
      videoUUID: this.videoLive.Video.uuid,
      sha256Path: join(this.outDirectory, this.streamingPlaylist.segmentsSha256Filename),
      streamingPlaylist: this.streamingPlaylist,
      sendToObjectStorage: this.streamingPlaylist.storage === FileStorage.OBJECT_STORAGE
    })
  }

  private buildTranscodingWrapper (toTranscode: { fps: number, resolution: number }[]) {
    const options = {
      streamingPlaylist: this.streamingPlaylist,
      videoLive: this.videoLive,

      lTags: this.lTags,

      sessionId: this.sessionId,
      inputLocalUrl: this.inputLocalUrl,
      inputPublicUrl: this.inputPublicUrl,

      toTranscode,

      bitrate: this.bitrate,
      ratio: this.ratio,
      hasAudio: this.hasAudio,
      hasVideo: this.hasVideo,
      probe: this.probe,

      segmentListSize: VIDEO_LIVE.SEGMENTS_LIST_SIZE,
      segmentDuration: getLiveSegmentTime(this.videoLive.latencyMode),

      outDirectory: this.outDirectory
    }

    return CONFIG.LIVE.TRANSCODING.ENABLED && CONFIG.LIVE.TRANSCODING.REMOTE_RUNNERS.ENABLED
      ? new RemoteTranscodingWrapper(options)
      : new FFmpegTranscodingWrapper(options)
  }

  private getPlaylistIdFromTS (segmentPath: string) {
    const playlistIdMatcher = /^([\d+])-/

    return basename(segmentPath).match(playlistIdMatcher)[1]
  }

  private getPlaylistNameFromTS (segmentPath: string) {
    return `${this.getPlaylistIdFromTS(segmentPath)}.m3u8`
  }

  private buildToTranscode () {
    return this.allResolutions.map(resolution => {
      let toTranscodeFPS: number

      if (resolution === VideoResolution.H_NOVIDEO) {
        return { resolution, fps: 0 }
      }

      try {
        toTranscodeFPS = computeOutputFPS({
          inputFPS: this.fps,
          resolution,
          isOriginResolution: resolution === this.inputResolution,
          type: 'live'
        })
      } catch (err) {
        err.liveVideoErrorCode = LiveVideoError.INVALID_INPUT_VIDEO_STREAM
        throw err
      }

      return { resolution, fps: toTranscodeFPS }
    })
  }
}

// ---------------------------------------------------------------------------

export {
  MuxingSession
}
