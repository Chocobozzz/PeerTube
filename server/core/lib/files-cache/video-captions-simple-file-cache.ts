import { join } from 'path'
import { logger } from '@server/helpers/logger.js'
import { doRequestAndSaveToFile } from '@server/helpers/requests.js'
import { FILES_CACHE } from '../../initializers/constants.js'
import { VideoModel } from '../../models/video/video.js'
import { VideoCaptionModel } from '../../models/video/video-caption.js'
import { AbstractSimpleFileCache } from './shared/abstract-simple-file-cache.js'

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
      return { isOwned: true, path: videoCaption.getFSPath() }
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

    const remoteUrl = videoCaption.getOriginFileUrl(video)
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
