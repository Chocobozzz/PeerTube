import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideoCaption } from '@server/types/models/index.js'
import { JobQueue } from '../job-queue/job-queue.js'
import { AbstractFileCache } from './shared/abstract-file-cache.js'

const lTags = loggerTagsFactory('lazy-load', 'video-captions')

export class VideoCaptionsFileCache extends AbstractFileCache<MVideoCaption> {
  protected loadModel (filename: string) {
    return VideoCaptionModel.loadByFilename(filename)
  }

  protected getFSFilePath (model: MVideoCaption) {
    return model.getFSFilePath()
  }

  protected getFSFileCachedPath (model: MVideoCaption) {
    return model.getFSFileCachedPath()
  }

  protected async onLazyFetchNotFound (model: MVideoCaption) {
    try {
      const video = await VideoModel.load(model.videoId)

      JobQueue.Instance.createJobAsync({ type: 'activitypub-refresher', payload: { type: 'video', url: video.url } })
    } catch (err) {
      logger.error('Error while refreshing video for lazy fetch', { ...lTags(), err })
    }
  }
}
