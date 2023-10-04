import { join } from 'path'
import { logger } from '@server/helpers/logger.js'
import { doRequestAndSaveToFile } from '@server/helpers/requests.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { MVideo, MVideoFile } from '@server/types/models/index.js'
import { CONFIG } from '../../initializers/config.js'
import { FILES_CACHE } from '../../initializers/constants.js'
import { VideoModel } from '../../models/video/video.js'
import { AbstractSimpleFileCache } from './shared/abstract-simple-file-cache.js'

class VideoTorrentsSimpleFileCache extends AbstractSimpleFileCache <string> {

  private static instance: VideoTorrentsSimpleFileCache

  private constructor () {
    super()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  async getFilePathImpl (filename: string) {
    const file = await VideoFileModel.loadWithVideoOrPlaylistByTorrentFilename(filename)
    if (!file) return undefined

    if (file.getVideo().isOwned()) {
      const downloadName = this.buildDownloadName(file.getVideo(), file)

      return { isOwned: true, path: join(CONFIG.STORAGE.TORRENTS_DIR, file.torrentFilename), downloadName }
    }

    return this.loadRemoteFile(filename)
  }

  // Key is the torrent filename
  protected async loadRemoteFile (key: string) {
    const file = await VideoFileModel.loadWithVideoOrPlaylistByTorrentFilename(key)
    if (!file) return undefined

    if (file.getVideo().isOwned()) throw new Error('Cannot load remote file of owned video.')

    // Used to fetch the path
    const video = await VideoModel.loadFull(file.getVideo().id)
    if (!video) return undefined

    const remoteUrl = file.getRemoteTorrentUrl(video)
    const destPath = join(FILES_CACHE.TORRENTS.DIRECTORY, file.torrentFilename)

    try {
      await doRequestAndSaveToFile(remoteUrl, destPath)

      const downloadName = this.buildDownloadName(video, file)

      return { isOwned: false, path: destPath, downloadName }
    } catch (err) {
      logger.info('Cannot fetch remote torrent file %s.', remoteUrl, { err })

      return undefined
    }
  }

  private buildDownloadName (video: MVideo, file: MVideoFile) {
    return `${video.name}-${file.resolution}p.torrent`
  }
}

export {
  VideoTorrentsSimpleFileCache
}
