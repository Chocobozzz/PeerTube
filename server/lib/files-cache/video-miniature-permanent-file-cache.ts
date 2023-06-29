import { CONFIG } from '@server/initializers/config'
import { THUMBNAILS_SIZE } from '@server/initializers/constants'
import { ThumbnailModel } from '@server/models/video/thumbnail'
import { MThumbnail } from '@server/types/models'
import { ThumbnailType } from '@shared/models'
import { AbstractPermanentFileCache } from './shared'

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
