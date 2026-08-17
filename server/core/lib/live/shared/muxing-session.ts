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
import { createLogger } from '@server/helpers/logger.js'
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
import { appendFile, readdir, readFile, stat } from 'fs/promises'
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
import { buildConcatenatedName, getLiveSegmentListSize, getLiveSegmentTime } from '../live-utils.js'
import { AbstractTranscodingWrapper, FFmpegTranscodingWrapper, RemoteTranscodingWrapper } from './transcoding-wrapper/index.js'

const logger = createLogger('muxing')

interface MuxingSessionEvents {
  'live-ready': (options: { videoUUID: string }) => void

  'bad-socket-health': (options: { videoUUID: string }) => void
  'duration-exceeded': (options: { videoUUID: string }) => void
  'quota-exceeded': (options: { videoUUID: string }) => void

  'transcoding-end': (options: { videoUUID: string }) => void
  'transcoding-error': (options: { videoUUID: string }) => void

  'after-cleanup': (options: { videoUUID: string }) => void
}

// oxlint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
declare interface MuxingSession {
  on<U extends keyof MuxingSessionEvents>(
    event: U,
    listener: MuxingSessionEvents[U]
  ): this

  emit<U extends keyof MuxingSessionEvents>(
    event: U,
    ...args: Parameters<MuxingSessionEvents[U]>
  ): boolean
}

// oxlint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
class MuxingSession extends EventEmitter implements MuxingSession {
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

  // Path -> Queue
  private readonly objectStorageSendQueues = new Map<string, PQueue>()

  private segmentsToProcessPerPlaylist: { [playlistId: string]: string[] } = {}

  // A segment can be seen twice: by the files watcher and by the cleanup task
  private readonly processedSegments = new Set<string>()

  // Playlist ID -> Queue
  // Segments of a same playlist are processed in order, and the cleanup can wait for the pending ones
  private readonly segmentProcessingQueues = new Map<string, PQueue>()

  // Closing the files watcher stops new events but not the async handlers it already started, that can still write
  // in the live directory (or in object storage): the cleanup waits for them
  private readonly pendingWatcherHandlers = new Set<Promise<void>>()

  private cleanupResolve: () => void
  // Settled by runCleanup(), and by destroy() as a safety net so waitForCleanup() callers can never hang
  private readonly cleanupPromise = new Promise<void>(resolve => {
    this.cleanupResolve = resolve
  })

  private streamingPlaylist: MStreamingPlaylistVideo
  private liveSegmentShaStore: LiveSegmentShaStore

  private filesWatcher: FSWatcher

  private masterPlaylistCreated = false
  private liveReady = false

  private aborted = false
  private cleanupScheduled = false

  private readonly isAbleToUploadVideoWithCache = memoizee((channelUserId: number) => {
    return isUserQuotaValid({ channelUserId, uploadSize: 1000 })
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
  }

  async runMuxing () {
    this.streamingPlaylist = await this.createLivePlaylist()

    const toTranscode = this.buildToTranscode()

    this.createLiveShaStore()
    this.createFiles(toTranscode)

    await this.prepareDirectories()

    // Watch the directory *before* running the transcoding process, so the watcher can never be created after the
    // session was cleaned up and destroyed: run() can abort and emit 'end' before it returns, and the cleanup would
    // then close a watcher that does not exist yet
    // Chokidar also emits 'add' for the files it finds on init, so we don't miss anything by watching earlier
    this.filesWatcher = watch(this.outDirectory, {
      // Ignore 'segments-sha256.json' and 'segments-sha256.json.tmp' files that are frequently updated and not useful
      ignored: path => path.endsWith('.json') || path.endsWith('json.tmp'),
      depth: 0
    })

    this.watchMasterFile()
    this.watchTSFiles()

    this.transcodingWrapper = this.buildTranscodingWrapper(toTranscode)

    this.transcodingWrapper.on('end', () => this.onTranscodedEnded())
    this.transcodingWrapper.on('error', () => this.onTranscodingError())

    // abort() was called before the wrapper existed
    // Abort the wrapper anyway, so it emits 'end' and the cleanup of this session is scheduled
    if (this.aborted) {
      logger.debug('Live muxing of %s was aborted before the transcoding process started.', this.videoUUID)

      this.transcodingWrapper.abort()
      return
    }

    await this.transcodingWrapper.run()
  }

  abort () {
    if (this.aborted) return
    this.aborted = true

    // The wrapper may not exist yet: runMuxing() checks this flag before running it
    this.transcodingWrapper?.abort()
  }

  // Resolves when this session does not write in the live directory anymore
  // The transcoding process has exited and all its segments have been hashed/stored
  waitForCleanup () {
    return this.cleanupPromise
  }

  destroy () {
    // Ensure the files watcher is always closed, even when the cleanup was never scheduled
    // (e.g. an ffmpeg error makes the transcoding wrapper abort() short-circuit without emitting 'end')
    this.closeWatcher()
      .catch(err => logger.error('Cannot close files watcher of %s.', this.outDirectory, { err }))

    // We removed its listeners below, so don't leave a pending timer that would emit an event nobody handles
    this.transcodingWrapper?.destroy()

    // Safety net: this session is over, so unblock everyone waiting for its cleanup even if it was never scheduled
    // (e.g. runMuxing() threw before the transcoding wrapper was able to run)
    this.cleanupResolve()

    this.removeAllListeners()
    this.isAbleToUploadVideoWithCache.clear()
    this.hasClientSocketInBadHealthWithCache.clear()
  }

  private closeWatcher () {
    if (!this.filesWatcher) return Promise.resolve()

    const watcher = this.filesWatcher
    this.filesWatcher = undefined

    return watcher.close()
  }

  // Watcher handlers are async and fire and forget: remember them so the cleanup can wait for the pending ones
  private trackWatcherHandler (handler: Promise<void>) {
    const tracked: Promise<void> = handler
      .catch(err => {
        logger.error('Error in live files watcher handler of %s.', this.outDirectory, { err })
      })
      .finally(() => {
        this.pendingWatcherHandlers.delete(tracked)
      })

    this.pendingWatcherHandlers.add(tracked)
  }

  private watchMasterFile () {
    const addHandler = async (path: string) => {
      if (path !== join(this.outDirectory, this.streamingPlaylist.playlistFilename)) return
      if (this.masterPlaylistCreated === true) return

      try {
        if (this.streamingPlaylist.storage === FileStorage.OBJECT_STORAGE) {
          const masterContent = await this.readNonEmptyMasterPlaylist(path)

          logger.debug('Uploading live master playlist on object storage for %s', this.videoUUID, { masterContent })

          await storeHLSFileFromContent(
            {
              video: this.streamingPlaylist.Video,
              pathOrFilename: this.streamingPlaylist.playlistFilename,
              content: masterContent
            }
          )
        }

        const hlsStreams = [ ...this.allResolutions ]
        if (this.hasAudio && this.hasVideo && !hlsStreams.includes(VideoResolution.H_NOVIDEO)) {
          hlsStreams.push(VideoResolution.H_NOVIDEO)
        }

        await this.streamingPlaylist.buildAndSetInfoHashes(
          this.videoLive.Video,
          Array.from(hlsStreams).map(r => ({ resolution: r }))
        )

        await this.streamingPlaylist.save()
      } catch (err) {
        logger.error('Cannot update streaming playlist.', { err })

        // Don't set masterPlaylistCreated: without a stored master playlist the live would be published but unplayable
        // Stop the session instead, so we don't federate a broken live
        this.stopBrokenSession()
        return
      }

      this.masterPlaylistCreated = true

      logger.info('Master playlist file for %s has been created', this.videoUUID)
    }

    this.filesWatcher.on('add', path => this.trackWatcherHandler(addHandler(path)))
  }

  // Throws if ffmpeg did not fill the master playlist in time: we don't want to store an empty one
  private async readNonEmptyMasterPlaylist (path: string) {
    const deadline = Date.now() + VIDEO_LIVE.MASTER_PLAYLIST_READ_TIMEOUT

    do {
      const content = await readFile(path, 'utf-8')
      if (content) return content

      // The session is over: bail out instead of making the cleanup wait for us
      if (this.cleanupScheduled) break

      // If the disk sync is slow, don't upload an empty master playlist on object storage
      // Wait for ffmpeg to correctly fill it
      await wait(100)
    } while (Date.now() < deadline)

    throw new Error(`Live master playlist ${path} is still empty after ${VIDEO_LIVE.MASTER_PLAYLIST_READ_TIMEOUT} ms`)
  }

  private watchTSFiles () {
    const startStreamDateTime = new Date().getTime()

    const addHandler = (segmentPath: string) => {
      if (segmentPath.endsWith('.ts') !== true) return

      logger.debug('Live add handler of TS file %s.', segmentPath)

      const playlistId = this.getPlaylistIdFromTS(segmentPath)
      if (!playlistId) {
        logger.warn('Cannot get the playlist id of live segment %s, ignoring it.', segmentPath)
        return
      }

      const segmentsToProcess = this.segmentsToProcessPerPlaylist[playlistId] || []
      // The cleanup waits for the queue, so we don't need to await it here
      void this.processSegments(playlistId, segmentsToProcess)

      this.segmentsToProcessPerPlaylist[playlistId] = [ segmentPath ]

      if (this.hasClientSocketInBadHealthWithCache(this.sessionId)) {
        this.emit('bad-socket-health', { videoUUID: this.videoUUID })
      } // Duration constraint check
      else if (this.isDurationConstraintValid(startStreamDateTime) !== true) {
        this.emit('duration-exceeded', { videoUUID: this.videoUUID })
      }
    }

    const deleteHandler = async (segmentPath: string) => {
      if (segmentPath.endsWith('.ts') !== true) return

      logger.debug('Live delete handler of TS file %s.', segmentPath)

      // The segment does not exist anymore so the cleanup won't list it: don't track it forever
      this.processedSegments.delete(segmentPath)

      this.liveSegmentShaStore.removeSegmentSha(segmentPath)

      if (this.streamingPlaylist.storage === FileStorage.OBJECT_STORAGE) {
        try {
          await removeHLSFileObjectStorageByPath(this.streamingPlaylist.Video, segmentPath)
        } catch (err) {
          logger.error('Cannot remove segment %s from object storage', segmentPath, { err })
        }
      }
    }

    this.filesWatcher.on('add', p => addHandler(p))
    this.filesWatcher.on('unlink', p => this.trackWatcherHandler(deleteHandler(p)))
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
      logger.error('Cannot stat %s or check quota of %d.', segmentPath, this.user.id, { err })
    }
  }

  private createFiles (toTranscode: { fps: number, resolution: number }[]) {
    for (const { resolution, fps } of toTranscode) {
      const file = new VideoFileModel({
        resolution,
        fps,
        size: -1,
        extname: '.ts',
        formatFlags: VideoFileFormatFlag.NONE,
        streams: resolution === VideoResolution.H_NOVIDEO
          ? VideoFileStream.AUDIO
          : VideoFileStream.VIDEO,
        storage: this.streamingPlaylist.storage,
        videoStreamingPlaylistId: this.streamingPlaylist.id
      })

      VideoFileModel.customUpsert(file, 'streaming-playlist', null)
        .catch(err => logger.error('Cannot create file for live streaming.', { err }))
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

  // All the segments must belong to the playlist of `playlistId`
  private processSegments (playlistId: string, segmentPaths: string[]) {
    if (segmentPaths.length === 0) return Promise.resolve()

    return this.getSegmentProcessingQueue(playlistId)
      .add(() =>
        // Catch per segment: mapSeries would abandon the next ones, and the cleanup is the last chance to process them
        Bluebird.mapSeries(segmentPaths, segmentPath => {
          return this.processSegment(segmentPath)
            .catch(err => {
              if (this.aborted) return

              logger.error('Cannot process segment %s.', segmentPath, { err })
            })
        })
      )
      .catch(err => {
        if (this.aborted) return

        logger.error('Cannot process segments', { err })
      })
  }

  private getSegmentProcessingQueue (playlistId: string) {
    if (!this.segmentProcessingQueues.has(playlistId)) {
      this.segmentProcessingQueues.set(playlistId, new PQueue({ concurrency: 1 }))
    }

    return this.segmentProcessingQueues.get(playlistId)
  }

  private async processSegment (segmentPath: string) {
    // Already processed by the files watcher or by the cleanup
    if (this.processedSegments.has(segmentPath)) return
    // Mark it before processing it so the cleanup doesn't process it again while we're working on it
    this.processedSegments.add(segmentPath)

    // The replay is an append only file: retrying a segment we already appended would duplicate it
    let appendedToReplay = false

    try {
      // Check user quota if the user enabled replay saving
      if (await this.isQuotaExceeded(segmentPath) === true) {
        this.emit('quota-exceeded', { videoUUID: this.videoUUID })
        return
      }

      // Add sha hash of previous segments, because ffmpeg should have finished generating them
      await this.liveSegmentShaStore.addSegmentSha(segmentPath)

      if (this.saveReplay) {
        await this.addSegmentToReplay(segmentPath)
        appendedToReplay = true
      }

      if (this.streamingPlaylist.storage === FileStorage.OBJECT_STORAGE) {
        try {
          await storeHLSFileFromPath(this.streamingPlaylist.Video, segmentPath)

          await this.processM3U8ToObjectStorage(segmentPath)
        } catch (err) {
          logger.error('Cannot store TS segment %s in object storage', segmentPath, { err })
        }
      }
    } catch (err) {
      // Forget the segment so the cleanup can retry it, unless retrying it would duplicate it in the replay
      if (!appendedToReplay) this.processedSegments.delete(segmentPath)

      throw err
    }

    // Master playlist and segment JSON file are created, live is ready
    if (this.masterPlaylistCreated && !this.liveReady) {
      this.liveReady = true

      this.emit('live-ready', { videoUUID: this.videoUUID })
    }
  }

  private async processM3U8ToObjectStorage (segmentPath: string) {
    const m3u8Path = join(this.outDirectory, this.getPlaylistNameFromTS(segmentPath))

    logger.debug('Process M3U8 file %s.', m3u8Path)

    const segmentName = basename(segmentPath)

    const playlistContent = await readFile(m3u8Path, 'utf-8')
    // Remove new chunk references, that will be processed later
    const filteredPlaylistContent = playlistContent.substring(0, playlistContent.lastIndexOf(segmentName) + segmentName.length) + '\n'

    try {
      if (!this.objectStorageSendQueues.has(m3u8Path)) {
        this.objectStorageSendQueues.set(m3u8Path, new PQueue({ concurrency: 1 }))
      }

      const queue = this.objectStorageSendQueues.get(m3u8Path)
      await queue.add(() =>
        storeHLSFileFromContent({
          video: this.streamingPlaylist.Video,
          pathOrFilename: m3u8Path,
          content: filteredPlaylistContent
        })
      )
    } catch (err) {
      logger.error('Cannot store in object storage m3u8 file %s', m3u8Path, { err })
    }
  }

  private onTranscodingError () {
    // On ffmpeg error the transcoding wrapper abort() short-circuits and never emits 'end'
    // So schedule the cleanup here too
    // Schedule it before emitting so listeners can wait for the cleanup to complete
    this.scheduleCleanup()

    this.emit('transcoding-error', { videoUUID: this.videoUUID })
  }

  // The live is broken but the transcoding process is still running and writing files
  // Contrary to onTranscodingError() don't schedule the cleanup here
  private stopBrokenSession () {
    this.emit('transcoding-error', { videoUUID: this.videoUUID })
  }

  private onTranscodedEnded () {
    // Don't log the input URL, which contains the stream key (a long lived secret)
    logger.info('RTMP transmuxing for video %s ended. Scheduling cleanup', this.videoUUID)

    // Schedule it before emitting so listeners can wait for the cleanup to complete
    this.scheduleCleanup()

    this.emit('transcoding-end', { videoUUID: this.videoUUID })
  }

  private scheduleCleanup () {
    // Cleanup can be triggered by both the transcoding end and error paths: only run it once
    if (this.cleanupScheduled) return
    this.cleanupScheduled = true

    this.runCleanup()
      .catch(err => logger.error('Cannot run cleanup of %s.', this.outDirectory, { err }))
  }

  private async runCleanup () {
    try {
      // The transcoding process exited so no new segment will be generated: we can close the watcher
      await this.closeWatcher()

      // Closing the watcher does not wait for the handlers it already started, that can still write files
      await Promise.all(this.pendingWatcherHandlers)

      // Wait for the segments the watcher already notified us about
      await Promise.all(Array.from(this.segmentProcessingQueues.values(), queue => queue.onIdle()))

      // Watcher events are asynchronous, so the last segments generated by the transcoding process may never have been
      // notified to us: list the output directory instead of relying on the events we received
      await this.processRemainingSegments()
    } catch (err) {
      logger.error(
        'Cannot close watchers of %s or process remaining hash segments.',
        this.outDirectory,
        { err }
      )
    }

    this.cleanupResolve()

    this.emit('after-cleanup', { videoUUID: this.videoUUID })
  }

  private async processRemainingSegments () {
    const filenames = await readdir(this.outDirectory)

    const segmentPaths = filenames
      // Segments are generated with a zero padded counter (%v-%06d.ts) so sorting them by name keeps the live order
      .filter(f => f.endsWith(VIDEO_LIVE.EXTENSION))
      .sort()
      .map(f => join(this.outDirectory, f))
      .filter(p => !this.processedSegments.has(p))

    let remainingCount = 0
    const perPlaylist = new Map<string, string[]>()

    for (const segmentPath of segmentPaths) {
      const playlistId = this.getPlaylistIdFromTS(segmentPath)
      // Not a segment generated by our transcoding process
      if (!playlistId) continue

      if (!perPlaylist.has(playlistId)) perPlaylist.set(playlistId, [])
      perPlaylist.get(playlistId).push(segmentPath)

      remainingCount++
    }

    if (remainingCount === 0) return

    logger.debug('Processing %d remaining live segments of %s.', remainingCount, this.videoUUID)

    await Promise.all(
      Array.from(perPlaylist, ([ playlistId, paths ]) => this.processSegments(playlistId, paths))
    )
  }

  private hasClientSocketInBadHealth (sessionId: string) {
    const rtmpSession = this.context.sessions.get(sessionId)

    if (!rtmpSession) {
      logger.warn('Cannot get session %s to check players socket health.', sessionId)
      return
    }

    for (const playerSessionId of rtmpSession.players) {
      const playerSession = this.context.sessions.get(playerSessionId)

      if (!playerSession) {
        logger.error('Cannot get player session %s to check socket health.', playerSession)
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

    logger.debug(`Add segment ${segmentPath} to replay ${dest}`)

    try {
      const data = await readFile(segmentPath)

      await appendFile(dest, data)
    } catch (err) {
      logger.error('Cannot copy segment %s to replay directory.', segmentPath, { err })
    }
  }

  private async createLivePlaylist (): Promise<MStreamingPlaylistVideo> {
    const { playlist } = await VideoStreamingPlaylistModel.loadOrGenerate(this.videoLive.Video)

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

      sessionId: this.sessionId,
      inputLocalUrl: this.inputLocalUrl,
      inputPublicUrl: this.inputPublicUrl,

      toTranscode,

      bitrate: this.bitrate,
      ratio: this.ratio,
      hasAudio: this.hasAudio,
      hasVideo: this.hasVideo,
      probe: this.probe,

      segmentListSize: getLiveSegmentListSize({
        latencyMode: this.videoLive.latencyMode,
        dvrWindow: this.videoLive.dvrWindow
      }),
      segmentDuration: getLiveSegmentTime(this.videoLive.latencyMode),

      outDirectory: this.outDirectory
    }

    return CONFIG.LIVE.TRANSCODING.ENABLED && CONFIG.LIVE.TRANSCODING.REMOTE_RUNNERS.ENABLED
      ? new RemoteTranscodingWrapper(options)
      : new FFmpegTranscodingWrapper(options)
  }

  // Returns undefined if the file was not generated by our transcoding process
  private getPlaylistIdFromTS (segmentPath: string) {
    const playlistIdMatcher = /^(\d+)-/

    return basename(segmentPath).match(playlistIdMatcher)?.[1]
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
