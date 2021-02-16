import { join } from 'path'
import { doRequestAndSaveToFile } from '@server/helpers/requests'
import { VideoFileModel } from '@server/models/video/video-file'
import { CONFIG } from '../../initializers/config'
import { FILES_CACHE } from '../../initializers/constants'
import { VideoModel } from '../../models/video/video'
import { AbstractVideoStaticFileCache } from './abstract-video-static-file-cache'

class VideosTorrentCache extends AbstractVideoStaticFileCache <string> {

  private static instance: VideosTorrentCache

  private constructor () {
    super()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  async getFilePathImpl (filename: string) {
    const file = await VideoFileModel.loadWithVideoOrPlaylistByTorrentFilename(filename)
    if (!file) return undefined

    if (file.getVideo().isOwned()) return { isOwned: true, path: join(CONFIG.STORAGE.TORRENTS_DIR, file.torrentFilename) }

    return this.loadRemoteFile(filename)
  }

  // Key is the torrent filename
  protected async loadRemoteFile (key: string) {
    const file = await VideoFileModel.loadWithVideoOrPlaylistByTorrentFilename(key)
    if (!file) return undefined

    if (file.getVideo().isOwned()) throw new Error('Cannot load remote file of owned video.')

    // Used to fetch the path
    const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(file.getVideo().id)
    if (!video) return undefined

    const remoteUrl = file.getRemoteTorrentUrl(video)
    const destPath = join(FILES_CACHE.TORRENTS.DIRECTORY, file.torrentFilename)

    await doRequestAndSaveToFile({ uri: remoteUrl }, destPath)

    const downloadName = `${video.name}-${file.resolution}p.torrent`

    return { isOwned: false, path: destPath, downloadName }
  }
}

export {
  VideosTorrentCache
}
