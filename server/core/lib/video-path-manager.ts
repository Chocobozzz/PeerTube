import { FileStorage } from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { Awaitable } from '@peertube/peertube-typescript-utils'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { extractVideo } from '@server/helpers/video.js'
import { CONFIG } from '@server/initializers/config.js'
import { DIRECTORIES } from '@server/initializers/constants.js'
import {
  MStreamingPlaylistVideo,
  MVideo,
  MVideoFile,
  MVideoFileStreamingPlaylistVideo,
  MVideoFileVideo,
  MVideoWithFile
} from '@server/types/models/index.js'
import { Mutex } from 'async-mutex'
import { remove } from 'fs-extra/esm'
import { extname, join } from 'path'
import { makeHLSFileAvailable, makeWebVideoFileAvailable } from './object-storage/index.js'
import { getHLSDirectory, getHlsResolutionPlaylistFilename } from './paths.js'
import { isVideoInPrivateDirectory } from './video-privacy.js'

type MakeAvailableCB <T> = (path: string) => Awaitable<T>
type MakeAvailableMultipleCB <T> = (paths: string[]) => Awaitable<T>
type MakeAvailableCreateMethod = { method: () => Awaitable<string>, clean: boolean }

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

  // ---------------------------------------------------------------------------

  async makeAvailableVideoFiles <T> (videoFiles: (MVideoFileVideo | MVideoFileStreamingPlaylistVideo)[], cb: MakeAvailableMultipleCB<T>) {
    const createMethods: MakeAvailableCreateMethod[] = []

    for (const videoFile of videoFiles) {
      if (videoFile.storage === FileStorage.FILE_SYSTEM) {
        createMethods.push({
          method: () => this.getFSVideoFileOutputPath(videoFile.getVideoOrStreamingPlaylist(), videoFile),
          clean: false
        })

        continue
      }

      const destination = this.buildTMPDestination(videoFile.filename)

      if (videoFile.isHLS()) {
        const playlist = (videoFile as MVideoFileStreamingPlaylistVideo).VideoStreamingPlaylist

        createMethods.push({
          method: () => makeHLSFileAvailable(playlist, videoFile.filename, destination),
          clean: true
        })
      } else {
        createMethods.push({
          method: () => makeWebVideoFileAvailable(videoFile.filename, destination),
          clean: true
        })
      }
    }

    return this.makeAvailableFactory({ createMethods, cbContext: cb })
  }

  async makeAvailableVideoFile <T> (videoFile: MVideoFileVideo | MVideoFileStreamingPlaylistVideo, cb: MakeAvailableCB<T>) {
    return this.makeAvailableVideoFiles([ videoFile ], paths => cb(paths[0]))
  }

  async makeAvailableMaxQualityFiles <T> (
    video: MVideoWithFile,
    cb: (options: { videoPath: string, separatedAudioPath: string }) => Awaitable<T>
  ) {
    const { videoFile, separatedAudioFile } = video.getMaxQualityAudioAndVideoFiles()

    const files = [ videoFile ]
    if (separatedAudioFile) files.push(separatedAudioFile)

    return this.makeAvailableVideoFiles(files, ([ videoPath, separatedAudioPath ]) => {
      return cb({ videoPath, separatedAudioPath })
    })
  }

  // ---------------------------------------------------------------------------

  async makeAvailableResolutionPlaylistFile <T> (videoFile: MVideoFileStreamingPlaylistVideo, cb: MakeAvailableCB<T>) {
    const filename = getHlsResolutionPlaylistFilename(videoFile.filename)

    if (videoFile.storage === FileStorage.FILE_SYSTEM) {
      return this.makeAvailableFactory({
        createMethods: [
          {
            method: () => join(getHLSDirectory(videoFile.getVideo()), filename),
            clean: false
          }
        ],
        cbContext: paths => cb(paths[0])
      })
    }

    const playlist = videoFile.VideoStreamingPlaylist
    return this.makeAvailableFactory({
      createMethods: [
        {
          method: () => makeHLSFileAvailable(playlist, filename, this.buildTMPDestination(filename)),
          clean: true
        }
      ],
      cbContext: paths => cb(paths[0])
    })
  }

  async makeAvailablePlaylistFile <T> (playlist: MStreamingPlaylistVideo, filename: string, cb: MakeAvailableCB<T>) {
    if (playlist.storage === FileStorage.FILE_SYSTEM) {
      return this.makeAvailableFactory({
        createMethods: [
          {
            method: () => join(getHLSDirectory(playlist.Video), filename),
            clean: false
          }
        ],
        cbContext: paths => cb(paths[0])
      })
    }

    return this.makeAvailableFactory({
      createMethods: [
        {
          method: () => makeHLSFileAvailable(playlist, filename, this.buildTMPDestination(filename)),
          clean: true
        }
      ],
      cbContext: paths => cb(paths[0])
    })
  }

  // ---------------------------------------------------------------------------

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

  private async makeAvailableFactory <T> (options: {
    createMethods: MakeAvailableCreateMethod[]
    cbContext: MakeAvailableMultipleCB<T>
  }) {
    const { cbContext, createMethods } = options

    let result: T

    const created: { destination: string, clean: boolean }[] = []

    const cleanup = async () => {
      for (const { destination, clean } of created) {
        if (!destination || !clean) continue

        try {
          await remove(destination)
        } catch (err) {
          logger.error('Cannot remove ' + destination, { err })
        }
      }
    }

    for (const { method, clean } of createMethods) {
      created.push({
        destination: await method(),
        clean
      })
    }

    try {
      result = await cbContext(created.map(c => c.destination))
    } catch (err) {
      await cleanup()

      throw err
    }

    await cleanup()

    return result
  }

  buildTMPDestination (filename: string) {
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
