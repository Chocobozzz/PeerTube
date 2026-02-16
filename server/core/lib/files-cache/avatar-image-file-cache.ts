import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { MActorImage } from '@server/types/models/index.js'
import { AbstractImageFileCache } from './shared/abstract-image-file-cache.js'

export class AvatarImageFileCache extends AbstractImageFileCache<MActorImage> {
  protected loadModel (filename: string) {
    return ActorImageModel.loadByFilename(filename)
  }

  protected getFSFilePath (model: MActorImage) {
    return model.getFSPath()
  }

  protected getFSFileCachedPath (model: MActorImage) {
    return model.getFSCachedPath()
  }
}
