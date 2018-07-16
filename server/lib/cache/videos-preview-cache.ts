import { join } from 'path'
import { CACHE, CONFIG, STATIC_PATHS } from '../../initializers'
import { VideoModel } from '../../models/video/video'
import { AbstractVideoStaticFileCache } from './abstract-video-static-file-cache'

class VideosPreviewCache extends AbstractVideoStaticFileCache <string> {

  private static instance: VideosPreviewCache

  private constructor () {
    super()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  async getFilePath (videoUUID: string) {
    const video = await VideoModel.loadByUUID(videoUUID)
    if (!video) return undefined

    if (video.isOwned()) return join(CONFIG.STORAGE.PREVIEWS_DIR, video.getPreviewName())

    return this.loadFromLRU(videoUUID)
  }

  protected async loadRemoteFile (key: string) {
    const video = await VideoModel.loadByUUIDAndPopulateAccountAndServerAndTags(key)
    if (!video) return undefined

    if (video.isOwned()) throw new Error('Cannot load remote preview of owned video.')

    const remoteStaticPath = join(STATIC_PATHS.PREVIEWS, video.getPreviewName())
    const destPath = join(CACHE.PREVIEWS.DIRECTORY, video.getPreviewName())

    return this.saveRemoteVideoFileAndReturnPath(video, remoteStaticPath, destPath)
  }
}

export {
  VideosPreviewCache
}
