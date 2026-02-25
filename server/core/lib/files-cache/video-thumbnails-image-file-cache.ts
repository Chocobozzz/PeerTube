import { ThumbnailModel } from '@server/models/video/thumbnail.js'
import { MThumbnail } from '@server/types/models/index.js'
import { AbstractImageFileCache } from './shared/abstract-image-file-cache.js'

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
}
