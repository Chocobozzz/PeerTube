import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { ThumbnailModel } from '@server/models/video/thumbnail.js'
import { VideoModel } from '@server/models/video/video.js'
import { MThumbnail } from '@server/types/models/index.js'
import { scheduleVideoRefreshIfNeeded } from '../activitypub/videos/refresh.js'
import { AbstractImageFileCache } from './shared/abstract-image-file-cache.js'

const lTags = loggerTagsFactory('lazy-load', 'video-thumbnails')

export class VideoThumbnailsImageFileCache extends AbstractImageFileCache<MThumbnail> {
  protected loadModel (filename: string) {
    return ThumbnailModel.loadByFilename(filename)
  }

  protected getFSFilePath (model: MThumbnail) {
    return model.getFSPath()
  }

  protected getFSFileCachedPath (model: MThumbnail) {
    return model.getFSCachedPath()
  }

  protected async onLazyFetchNotFound (model: MThumbnail) {
    try {
      const video = await VideoModel.load(model.videoId)

      scheduleVideoRefreshIfNeeded(video)
    } catch (err) {
      logger.error('Error while refreshing video for lazy fetch', { ...lTags(), err })
    }
  }
}
