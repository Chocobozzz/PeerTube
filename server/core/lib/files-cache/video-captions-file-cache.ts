import { isVTTFileValid } from '@server/helpers/custom-validators/video-captions.js'
import { createLogger } from '@server/helpers/logger.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideoCaption } from '@server/types/models/index.js'
import { remove } from 'fs-extra/esm'
import { scheduleVideoRefreshIfNeeded } from '../activitypub/videos/refresh.js'
import { AbstractFileCache } from './shared/abstract-file-cache.js'

const logger = createLogger('lazy-load', 'caption')

export class VideoCaptionsFileCache extends AbstractFileCache<MVideoCaption> {
  protected readonly cacheType = 'VIDEO_CAPTIONS'

  protected loadModel (filename: string) {
    return VideoCaptionModel.loadByFilename(filename)
  }

  protected getFSFilePath (model: MVideoCaption) {
    return model.getFSFilePath()
  }

  protected getFSFileCachedPath (model: MVideoCaption) {
    return model.getFSFileCachedPath()
  }

  protected async downloadImpl (caption: MVideoCaption, destPath: string) {
    await super.downloadImpl(caption, destPath)

    if (await isVTTFileValid(destPath) !== true) {
      await remove(destPath)

      throw new Error(`Remote caption ${caption.fileUrl} is not a valid VTT file`)
    }
  }

  protected async onLazyFetchNotFound (model: MVideoCaption) {
    try {
      const video = await VideoModel.load(model.videoId)

      scheduleVideoRefreshIfNeeded(video)
    } catch (err) {
      logger.error('Error while refreshing video for lazy fetch', { err })
    }
  }
}
