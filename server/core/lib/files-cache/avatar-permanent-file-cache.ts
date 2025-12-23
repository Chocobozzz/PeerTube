import { CONFIG } from '@server/initializers/config.js'
import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { MActorImage } from '@server/types/models/index.js'
import { AbstractPermanentFileCache } from './shared/index.js'

export class AvatarPermanentFileCache extends AbstractPermanentFileCache<MActorImage> {

  constructor () {
    super(CONFIG.STORAGE.ACTOR_IMAGES_DIR)
  }

  protected loadModel (filename: string) {
    return ActorImageModel.loadByFilename(filename)
  }

  protected getImageSize (image: MActorImage): { width: number, height: number } {
    if (image.width && image.height) {
      return {
        height: image.height,
        width: image.width
      }
    }

    return undefined
  }
}
