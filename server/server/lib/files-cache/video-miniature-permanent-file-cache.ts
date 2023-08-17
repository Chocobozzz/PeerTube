import { CONFIG } from '@server/initializers/config.js'
import { THUMBNAILS_SIZE } from '@server/initializers/constants.js'
import { ThumbnailModel } from '@server/models/video/thumbnail.js'
import { MThumbnail } from '@server/types/models/index.js'
import { ThumbnailType } from '@peertube/peertube-models'
import { AbstractPermanentFileCache } from './shared/index.js'

export class VideoMiniaturePermanentFileCache extends AbstractPermanentFileCache<MThumbnail> {

  constructor () {
    super(CONFIG.STORAGE.THUMBNAILS_DIR)
  }

  protected loadModel (filename: string) {
    return ThumbnailModel.loadByFilename(filename, ThumbnailType.MINIATURE)
  }

  protected getImageSize (image: MThumbnail): { width: number, height: number } {
    if (image.width && image.height) {
      return {
        height: image.height,
        width: image.width
      }
    }

    return THUMBNAILS_SIZE
  }
}
