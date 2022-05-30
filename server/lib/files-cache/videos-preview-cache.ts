import { join } from 'path'
import { FILES_CACHE } from '../../initializers/constants'
import { VideoModel } from '../../models/video/video'
import { AbstractVideoStaticFileCache } from './abstract-video-static-file-cache'
import { doRequestAndSaveToFile } from '@server/helpers/requests'
import { ThumbnailModel } from '@server/models/video/thumbnail'
import { ThumbnailType } from '@shared/models'
import { logger } from '@server/helpers/logger'

class VideosPreviewCache extends AbstractVideoStaticFileCache <string> {

  private static instance: VideosPreviewCache

  private constructor () {
    super()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  async getFilePathImpl (filename: string) {
    const thumbnail = await ThumbnailModel.loadWithVideoByFilename(filename, ThumbnailType.PREVIEW)
    if (!thumbnail) return undefined

    if (thumbnail.Video.isOwned()) return { isOwned: true, path: thumbnail.getPath() }

    return this.loadRemoteFile(thumbnail.Video.uuid)
  }

  // Key is the video UUID
  protected async loadRemoteFile (key: string) {
    const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(key)
    if (!video) return undefined

    if (video.isOwned()) throw new Error('Cannot load remote preview of owned video.')

    const preview = video.getPreview()
    const destPath = join(FILES_CACHE.PREVIEWS.DIRECTORY, preview.filename)

    const remoteUrl = preview.getFileUrl(video)
    await doRequestAndSaveToFile(remoteUrl, destPath)

    logger.debug('Fetched remote preview %s to %s.', remoteUrl, destPath)

    return { isOwned: false, path: destPath }
  }
}

export {
  VideosPreviewCache
}
