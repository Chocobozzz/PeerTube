import { StoryboardModel } from '@server/models/video/storyboard.js'
import { MStoryboard } from '@server/types/models/index.js'
import { AbstractImageFileCache } from './shared/abstract-image-file-cache.js'

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
}
