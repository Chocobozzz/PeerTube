import { join } from 'path'
import { FILES_CACHE } from '../../initializers/constants'
import { VideoModel } from '../../models/video/video'
import { ThumbnailModel } from '../../models/video/thumbnail'
import { AbstractVideoStaticFileCache } from './abstract-video-static-file-cache'
import { doRequestAndSaveToFile } from '@server/helpers/requests'

class VideosPreviewCache extends AbstractVideoStaticFileCache <string> {

  private static instance: VideosPreviewCache

  private constructor () {
    super()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  async getFilePathImpl (filename: string) {
    const { videoId } = await ThumbnailModel.loadByName(filename)
    const video = await VideoModel.load(videoId)
    if (!video) return undefined

    if (video.isOwned()) return { isOwned: true, path: video.getPreview().getPath() }

    return this.loadRemoteFile(video.uuid)
  }

  protected async loadRemoteFile (key: string) {
    const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(key)
    if (!video) return undefined

    if (video.isOwned()) throw new Error('Cannot load remote preview of owned video.')

    const preview = video.getPreview()
    const destPath = join(FILES_CACHE.PREVIEWS.DIRECTORY, preview.filename)

    const remoteUrl = preview.getFileUrl(video)
    await doRequestAndSaveToFile({ uri: remoteUrl }, destPath)

    return { isOwned: false, path: destPath }
  }
}

export {
  VideosPreviewCache
}
