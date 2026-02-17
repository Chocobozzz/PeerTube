import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { MVideoCaption } from '@server/types/models/index.js'
import { AbstractFileCache } from './shared/abstract-file-cache.js'

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
}
