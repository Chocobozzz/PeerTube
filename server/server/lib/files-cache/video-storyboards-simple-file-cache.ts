import { join } from 'path'
import { logger } from '@server/helpers/logger.js'
import { doRequestAndSaveToFile } from '@server/helpers/requests.js'
import { StoryboardModel } from '@server/models/video/storyboard.js'
import { FILES_CACHE } from '../../initializers/constants.js'
import { AbstractSimpleFileCache } from './shared/abstract-simple-file-cache.js'

class VideoStoryboardsSimpleFileCache extends AbstractSimpleFileCache <string> {

  private static instance: VideoStoryboardsSimpleFileCache

  private constructor () {
    super()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  async getFilePathImpl (filename: string) {
    const storyboard = await StoryboardModel.loadWithVideoByFilename(filename)
    if (!storyboard) return undefined

    if (storyboard.Video.isOwned()) return { isOwned: true, path: storyboard.getPath() }

    return this.loadRemoteFile(storyboard.filename)
  }

  // Key is the storyboard filename
  protected async loadRemoteFile (key: string) {
    const storyboard = await StoryboardModel.loadWithVideoByFilename(key)
    if (!storyboard) return undefined

    const destPath = join(FILES_CACHE.STORYBOARDS.DIRECTORY, storyboard.filename)
    const remoteUrl = storyboard.getOriginFileUrl(storyboard.Video)

    try {
      await doRequestAndSaveToFile(remoteUrl, destPath)

      logger.debug('Fetched remote storyboard %s to %s.', remoteUrl, destPath)

      return { isOwned: false, path: destPath }
    } catch (err) {
      logger.info('Cannot fetch remote storyboard file %s.', remoteUrl, { err })

      return undefined
    }
  }
}

export {
  VideoStoryboardsSimpleFileCache
}
