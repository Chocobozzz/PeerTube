import { FileStorage } from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { extractVideo } from '@server/helpers/video.js'
import { CONFIG } from '@server/initializers/config.js'
import { DIRECTORIES } from '@server/initializers/constants.js'
import {
  MStreamingPlaylistVideo,
  MVideo,
  MVideoFile,
  MVideoFileStreamingPlaylistVideo,
  MVideoFileVideo
} from '@server/types/models/index.js'
import { Mutex } from 'async-mutex'
import { remove } from 'fs-extra/esm'
import { extname, join } from 'path'
import { makeHLSFileAvailable, makeWebVideoFileAvailable } from './object-storage/index.js'
import { getHLSDirectory, getHLSRedundancyDirectory, getHlsResolutionPlaylistFilename } from './paths.js'
import { isVideoInPrivateDirectory } from './video-privacy.js'

type MakeAvailableCB <T> = (path: string) => Promise<T> | T

const lTags = loggerTagsFactory('video-path-manager')

class VideoPathManager {

  private static instance: VideoPathManager

  // Key is a video UUID
  private readonly videoFileMutexStore = new Map<string, Mutex>()

  private constructor () {}

  getFSHLSOutputPath (video: MVideo, filename?: string) {
    const base = getHLSDirectory(video)
    if (!filename) return base

    return join(base, filename)
  }

  getFSRedundancyVideoFilePath (videoOrPlaylist: MVideo | MStreamingPlaylistVideo, videoFile: MVideoFile) {
    if (videoFile.isHLS()) {
      const video = extractVideo(videoOrPlaylist)

      return join(getHLSRedundancyDirectory(video), videoFile.filename)
    }

    return join(CONFIG.STORAGE.REDUNDANCY_DIR, videoFile.filename)
  }

  getFSVideoFileOutputPath (videoOrPlaylist: MVideo | MStreamingPlaylistVideo, videoFile: MVideoFile) {
    const video = extractVideo(videoOrPlaylist)

    if (videoFile.isHLS()) {
      return join(getHLSDirectory(video), videoFile.filename)
    }

    if (isVideoInPrivateDirectory(video.privacy)) {
      return join(DIRECTORIES.WEB_VIDEOS.PRIVATE, videoFile.filename)
    }

    return join(DIRECTORIES.WEB_VIDEOS.PUBLIC, videoFile.filename)
  }

  getFSOriginalVideoFilePath (filename: string) {
    return join(DIRECTORIES.ORIGINAL_VIDEOS, filename)
  }

  async makeAvailableVideoFile <T> (videoFile: MVideoFileVideo | MVideoFileStreamingPlaylistVideo, cb: MakeAvailableCB<T>) {
    if (videoFile.storage === FileStorage.FILE_SYSTEM) {
      return this.makeAvailableFactory(
        () => this.getFSVideoFileOutputPath(videoFile.getVideoOrStreamingPlaylist(), videoFile),
        false,
        cb
      )
    }

    const destination = this.buildTMPDestination(videoFile.filename)

    if (videoFile.isHLS()) {
      const playlist = (videoFile as MVideoFileStreamingPlaylistVideo).VideoStreamingPlaylist

      return this.makeAvailableFactory(
        () => makeHLSFileAvailable(playlist, videoFile.filename, destination),
        true,
        cb
      )
    }

    return this.makeAvailableFactory(
      () => makeWebVideoFileAvailable(videoFile.filename, destination),
      true,
      cb
    )
  }

  async makeAvailableResolutionPlaylistFile <T> (videoFile: MVideoFileStreamingPlaylistVideo, cb: MakeAvailableCB<T>) {
    const filename = getHlsResolutionPlaylistFilename(videoFile.filename)

    if (videoFile.storage === FileStorage.FILE_SYSTEM) {
      return this.makeAvailableFactory(
        () => join(getHLSDirectory(videoFile.getVideo()), filename),
        false,
        cb
      )
    }

    const playlist = videoFile.VideoStreamingPlaylist
    return this.makeAvailableFactory(
      () => makeHLSFileAvailable(playlist, filename, this.buildTMPDestination(filename)),
      true,
      cb
    )
  }

  async makeAvailablePlaylistFile <T> (playlist: MStreamingPlaylistVideo, filename: string, cb: MakeAvailableCB<T>) {
    if (playlist.storage === FileStorage.FILE_SYSTEM) {
      return this.makeAvailableFactory(
        () => join(getHLSDirectory(playlist.Video), filename),
        false,
        cb
      )
    }

    return this.makeAvailableFactory(
      () => makeHLSFileAvailable(playlist, filename, this.buildTMPDestination(filename)),
      true,
      cb
    )
  }

  async lockFiles (videoUUID: string) {
    if (!this.videoFileMutexStore.has(videoUUID)) {
      this.videoFileMutexStore.set(videoUUID, new Mutex())
    }

    const mutex = this.videoFileMutexStore.get(videoUUID)
    const releaser = await mutex.acquire()

    logger.debug('Locked files of %s.', videoUUID, lTags(videoUUID))

    return releaser
  }

  unlockFiles (videoUUID: string) {
    const mutex = this.videoFileMutexStore.get(videoUUID)

    mutex.release()

    logger.debug('Released lockfiles of %s.', videoUUID, lTags(videoUUID))
  }

  private async makeAvailableFactory <T> (method: () => Promise<string> | string, clean: boolean, cb: MakeAvailableCB<T>) {
    let result: T

    const destination = await method()

    try {
      result = await cb(destination)
    } catch (err) {
      if (destination && clean) await remove(destination)
      throw err
    }

    if (clean) await remove(destination)

    return result
  }

  private buildTMPDestination (filename: string) {
    return join(CONFIG.STORAGE.TMP_DIR, buildUUID() + extname(filename))

  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  VideoPathManager
}
