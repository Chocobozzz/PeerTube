import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { StoryboardModel } from '@server/models/video/storyboard.js'
import { VideoModel } from '@server/models/video/video.js'
import { MStoryboard } from '@server/types/models/index.js'
import { scheduleVideoRefreshIfNeeded } from '../activitypub/videos/index.js'
import { AbstractImageFileCache } from './shared/abstract-image-file-cache.js'

const lTags = loggerTagsFactory('lazy-load', 'video-storyboards')

export class VideoStoryboardsImageFileCache extends AbstractImageFileCache<MStoryboard> {
  protected loadModel (filename: string) {
    return StoryboardModel.loadByFilename(filename)
  }

  protected getFSFilePath (model: MStoryboard) {
    return model.getFSPath()
  }

  protected getFSFileCachedPath (model: MStoryboard) {
    return model.getFSCachedPath()
  }

  protected async onLazyFetchNotFound (model: MStoryboard) {
    try {
      const video = await VideoModel.load(model.videoId)

      scheduleVideoRefreshIfNeeded(video)
    } catch (err) {
      logger.error('Error while refreshing video for lazy fetch', { ...lTags(), err })
    }
  }
}
