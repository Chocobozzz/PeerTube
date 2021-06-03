import { Transaction } from 'sequelize/types'
import { logger } from '@server/helpers/logger'
import { ActorImageModel } from '@server/models/actor/actor-image'
import { MActorImage, MActorImages } from '@server/types/models'
import { ActorImageType } from '@shared/models'

type ImageInfo = {
  name: string
  fileUrl: string
  height: number
  width: number
  onDisk?: boolean
}

async function updateActorImageInstance (actor: MActorImages, type: ActorImageType, imageInfo: ImageInfo | null, t: Transaction) {
  const oldImageModel = type === ActorImageType.AVATAR
    ? actor.Avatar
    : actor.Banner

  if (oldImageModel) {
    // Don't update the avatar if the file URL did not change
    if (imageInfo?.fileUrl && oldImageModel.fileUrl === imageInfo.fileUrl) return actor

    try {
      await oldImageModel.destroy({ transaction: t })

      setActorImage(actor, type, null)
    } catch (err) {
      logger.error('Cannot remove old actor image of actor %s.', actor.url, { err })
    }
  }

  if (imageInfo) {
    const imageModel = await ActorImageModel.create({
      filename: imageInfo.name,
      onDisk: imageInfo.onDisk ?? false,
      fileUrl: imageInfo.fileUrl,
      height: imageInfo.height,
      width: imageInfo.width,
      type
    }, { transaction: t })

    setActorImage(actor, type, imageModel)
  }

  return actor
}

async function deleteActorImageInstance (actor: MActorImages, type: ActorImageType, t: Transaction) {
  try {
    if (type === ActorImageType.AVATAR) {
      await actor.Avatar.destroy({ transaction: t })

      actor.avatarId = null
      actor.Avatar = null
    } else {
      await actor.Banner.destroy({ transaction: t })

      actor.bannerId = null
      actor.Banner = null
    }
  } catch (err) {
    logger.error('Cannot remove old image of actor %s.', actor.url, { err })
  }

  return actor
}

// ---------------------------------------------------------------------------

export {
  ImageInfo,

  updateActorImageInstance,
  deleteActorImageInstance
}

// ---------------------------------------------------------------------------

function setActorImage (actorModel: MActorImages, type: ActorImageType, imageModel: MActorImage) {
  const id = imageModel
    ? imageModel.id
    : null

  if (type === ActorImageType.AVATAR) {
    actorModel.avatarId = id
    actorModel.Avatar = imageModel
  } else {
    actorModel.bannerId = id
    actorModel.Banner = imageModel
  }

  return actorModel
}
