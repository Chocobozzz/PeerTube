import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { MActorImage } from '@server/types/models/index.js'
import { refreshActorIfNeeded } from '../activitypub/actors/refresh.js'
import { AbstractImageFileCache } from './shared/abstract-image-file-cache.js'

const lTags = loggerTagsFactory('lazy-load', 'avatar-image')

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

  protected async onLazyFetchNotFound (model: MActorImage) {
    try {
      const actor = await ActorModel.loadForOutdated(model.actorId)

      await refreshActorIfNeeded({ actor, fetchedType: 'partial' })
    } catch (err) {
      logger.error('Error while refreshing actor for avatar image lazy fetch', { ...lTags(), err })
    }
  }
}
