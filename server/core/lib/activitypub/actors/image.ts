import { ActorImageType, ActorImageType_Type } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { MActorImage, MActorImages } from '@server/types/models/index.js'
import { Transaction } from 'sequelize'

type ImageInfo = {
  name: string
  fileUrl: string
  height: number
  width: number
  onDisk?: boolean
}

async function updateActorImages (actor: MActorImages, type: ActorImageType_Type, imagesInfo: ImageInfo[], t: Transaction) {
  const getAvatarsOrBanners = () => {
    const result = type === ActorImageType.AVATAR
      ? actor.Avatars
      : actor.Banners

    return result || []
  }

  if (imagesInfo.length === 0) {
    await deleteActorImages(actor, type, t)
  }

  // Cleanup old images that did not have a width
  for (const oldImageModel of getAvatarsOrBanners()) {
    if (oldImageModel.width) continue

    await safeDeleteActorImage(actor, oldImageModel, type, t)
  }

  for (const imageInfo of imagesInfo) {
    const oldImageModel = getAvatarsOrBanners().find(i => imageInfo.width && i.width === imageInfo.width)

    if (oldImageModel) {
      // Don't update the avatar if the file URL did not change
      if (imageInfo.fileUrl && oldImageModel.fileUrl === imageInfo.fileUrl) {
        continue
      }

      await safeDeleteActorImage(actor, oldImageModel, type, t)
    }

    const imageModel = await ActorImageModel.create({
      filename: imageInfo.name,
      onDisk: imageInfo.onDisk ?? false,
      fileUrl: imageInfo.fileUrl,
      height: imageInfo.height,
      width: imageInfo.width,
      type,
      actorId: actor.id
    }, { transaction: t })

    addActorImage(actor, type, imageModel)
  }

  return actor
}

async function deleteActorImages (actor: MActorImages, type: ActorImageType_Type, t: Transaction) {
  try {
    const association = buildAssociationName(type)

    for (const image of actor[association]) {
      await image.destroy({ transaction: t })
    }

    actor[association] = []
  } catch (err) {
    logger.error('Cannot remove old image of actor %s.', actor.url, { err })
  }

  return actor
}

async function safeDeleteActorImage (actor: MActorImages, toDelete: MActorImage, type: ActorImageType_Type, t: Transaction) {
  try {
    await toDelete.destroy({ transaction: t })

    const association = buildAssociationName(type)
    actor[association] = actor[association].filter(image => image.id !== toDelete.id)
  } catch (err) {
    logger.error('Cannot remove old actor image of actor %s.', actor.url, { err })
  }
}

// ---------------------------------------------------------------------------

export {
  type ImageInfo,

  updateActorImages,
  deleteActorImages
}

// ---------------------------------------------------------------------------

function addActorImage (actor: MActorImages, type: ActorImageType_Type, imageModel: MActorImage) {
  const association = buildAssociationName(type)
  if (!actor[association]) actor[association] = []

  actor[association].push(imageModel)
}

function buildAssociationName (type: ActorImageType_Type) {
  return type === ActorImageType.AVATAR
    ? 'Avatars'
    : 'Banners'
}
