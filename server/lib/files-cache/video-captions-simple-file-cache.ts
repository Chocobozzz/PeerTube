import { join } from 'path'
import { logger } from '@server/helpers/logger'
import { doRequestAndSaveToFile } from '@server/helpers/requests'
import { CONFIG } from '../../initializers/config'
import { FILES_CACHE } from '../../initializers/constants'
import { VideoModel } from '../../models/video/video'
import { VideoCaptionModel } from '../../models/video/video-caption'
import { AbstractSimpleFileCache } from './shared/abstract-simple-file-cache'

class VideoCaptionsSimpleFileCache extends AbstractSimpleFileCache <string> {

  private static instance: VideoCaptionsSimpleFileCache

  private constructor () {
    super()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  async getFilePathImpl (filename: string) {
    const videoCaption = await VideoCaptionModel.loadWithVideoByFilename(filename)
    if (!videoCaption) return undefined

    if (videoCaption.isOwned()) {
      return { isOwned: true, path: join(CONFIG.STORAGE.CAPTIONS_DIR, videoCaption.filename) }
    }

    return this.loadRemoteFile(filename)
  }

  // Key is the caption filename
  protected async loadRemoteFile (key: string) {
    const videoCaption = await VideoCaptionModel.loadWithVideoByFilename(key)
    if (!videoCaption) return undefined

    if (videoCaption.isOwned()) throw new Error('Cannot load remote caption of owned video.')

    // Used to fetch the path
    const video = await VideoModel.loadFull(videoCaption.videoId)
    if (!video) return undefined

    const remoteUrl = videoCaption.getFileUrl(video)
    const destPath = join(FILES_CACHE.VIDEO_CAPTIONS.DIRECTORY, videoCaption.filename)

    try {
      await doRequestAndSaveToFile(remoteUrl, destPath)

      return { isOwned: false, path: destPath }
    } catch (err) {
      logger.info('Cannot fetch remote caption file %s.', remoteUrl, { err })

      return undefined
    }
  }
}

export {
  VideoCaptionsSimpleFileCache
}
