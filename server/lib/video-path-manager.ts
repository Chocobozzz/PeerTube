import { remove } from 'fs-extra'
import { extname, join } from 'path'
import { extractVideo } from '@server/helpers/video'
import { CONFIG } from '@server/initializers/config'
import {
  MStreamingPlaylistVideo,
  MVideo,
  MVideoFile,
  MVideoFileStreamingPlaylistVideo,
  MVideoFileVideo,
  MVideoUUID
} from '@server/types/models'
import { buildUUID } from '@shared/core-utils'
import { VideoStorage } from '@shared/models'
import { makeHLSFileAvailable, makeWebTorrentFileAvailable } from './object-storage'
import { getHLSDirectory, getHLSRedundancyDirectory, getHlsResolutionPlaylistFilename } from './paths'

type MakeAvailableCB <T> = (path: string) => Promise<T> | T

class VideoPathManager {

  private static instance: VideoPathManager

  private constructor () {}

  getFSHLSOutputPath (video: MVideoUUID, filename?: string) {
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
    if (videoFile.isHLS()) {
      const video = extractVideo(videoOrPlaylist)

      return join(getHLSDirectory(video), videoFile.filename)
    }

    return join(CONFIG.STORAGE.VIDEOS_DIR, videoFile.filename)
  }

  async makeAvailableVideoFile <T> (videoFile: MVideoFileVideo | MVideoFileStreamingPlaylistVideo, cb: MakeAvailableCB<T>) {
    if (videoFile.storage === VideoStorage.FILE_SYSTEM) {
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
      () => makeWebTorrentFileAvailable(videoFile.filename, destination),
      true,
      cb
    )
  }

  async makeAvailableResolutionPlaylistFile <T> (videoFile: MVideoFileStreamingPlaylistVideo, cb: MakeAvailableCB<T>) {
    const filename = getHlsResolutionPlaylistFilename(videoFile.filename)

    if (videoFile.storage === VideoStorage.FILE_SYSTEM) {
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
    if (playlist.storage === VideoStorage.FILE_SYSTEM) {
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
