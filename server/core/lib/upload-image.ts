import { LogoType, UploadImageType, UploadImageType_Type } from '@peertube/peertube-models'
import { buildUUID, getLowercaseExtension } from '@peertube/peertube-node-utils'
import { buildImageSize, processImage } from '@server/helpers/image-utils.js'
import { UploadImageModel } from '@server/models/application/upload-image.js'
import { copy, remove } from 'fs-extra/esm'
import { retryTransactionWrapper } from '../helpers/database-utils.js'
import { UPLOAD_IMAGES_SIZE } from '../initializers/constants.js'
import { sequelizeTypescript } from '../initializers/database.js'
import { MActorUploadImages } from '../types/models/index.js'

export async function replaceUploadImage (options: {
  actor: MActorUploadImages
  imagePhysicalFile: { path: string }
  type: UploadImageType_Type
}) {
  const { actor, imagePhysicalFile, type } = options

  const processedImages = await generateImageSizes(imagePhysicalFile.path, type)
  await remove(imagePhysicalFile.path)

  return retryTransactionWrapper(() =>
    sequelizeTypescript.transaction(async t => {
      const imagesToDelete = await UploadImageModel.listByActorAndType(actor, type, t)

      for (const toDelete of imagesToDelete) {
        await toDelete.destroy({ transaction: t })

        actor.UploadImages = actor.UploadImages.filter(image => image.id !== toDelete.id)
      }

      for (const toCreate of processedImages) {
        const uploadImage = await UploadImageModel.create({
          filename: toCreate.imageName,
          height: toCreate.imageSize.height,
          width: toCreate.imageSize.width,
          fileUrl: null,
          type,
          actorId: actor.id
        }, { transaction: t })

        actor.UploadImages.push(uploadImage)
      }
    })
  )
}

async function generateImageSizes (imagePath: string, type: UploadImageType_Type) {
  if (imagePath.endsWith('.svg')) {
    const extension = getLowercaseExtension(imagePath)
    const imageName = buildUUID() + extension
    const destination = UploadImageModel.getFSPathOf(imageName)

    await copy(imagePath, destination)

    return [ { imageName, imageSize: { width: null, height: null } } ]
  }

  return Promise.all(UPLOAD_IMAGES_SIZE[type].map(size => generateImageSize({ ...size, imagePath })))
}

async function generateImageSize (options: {
  imagePath: string
  width: number
  height: number
}) {
  const { imagePath, width, height } = options

  const imageSize = await buildImageSize(imagePath, { width, height })

  const extension = getLowercaseExtension(imagePath)
  const imageName = buildUUID() + extension
  const destination = UploadImageModel.getFSPathOf(imageName)

  await processImage({ path: imagePath, destination, newSize: imageSize, keepOriginal: true })

  return { imageName, imageSize }
}

// ---------------------------------------------------------------------------

export async function deleteUploadImages (options: {
  actor: MActorUploadImages
  type: UploadImageType_Type
}) {
  const { actor, type } = options

  return retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async t => {
      const imagesToDelete = await UploadImageModel.listByActorAndType(actor, type, t)

      for (const toDelete of imagesToDelete) {
        await toDelete.destroy({ transaction: t })
      }

      actor.UploadImages = []
    })
  })
}

export function logoTypeToUploadImageEnum (logoType: LogoType) {
  switch (logoType) {
    case 'favicon':
      return UploadImageType.INSTANCE_FAVICON

    case 'header-wide':
      return UploadImageType.INSTANCE_HEADER_WIDE

    case 'header-square':
      return UploadImageType.INSTANCE_HEADER_SQUARE

    case 'opengraph':
      return UploadImageType.INSTANCE_OPENGRAPH

    default:
      return logoType satisfies never
  }
}
