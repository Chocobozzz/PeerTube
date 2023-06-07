import { CONFIG } from '@server/initializers/config'
import { ACTOR_IMAGES_SIZE } from '@server/initializers/constants'
import { ActorImageModel } from '@server/models/actor/actor-image'
import { MActorImage } from '@server/types/models'
import { AbstractPermanentFileCache } from './shared'

export class AvatarPermanentFileCache extends AbstractPermanentFileCache<MActorImage> {

  constructor () {
    super(CONFIG.STORAGE.ACTOR_IMAGES)
  }

  protected loadModel (filename: string) {
    return ActorImageModel.loadByName(filename)
  }

  protected getImageSize (image: MActorImage): { width: number, height: number } {
    if (image.width && image.height) {
      return {
        height: image.height,
        width: image.width
      }
    }

    return ACTOR_IMAGES_SIZE[image.type][0]
  }
}
