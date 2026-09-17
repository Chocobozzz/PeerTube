import { FileStorage, LogoType, UploadImageType, UploadImageType_Type } from '@peertube/peertube-models'
import { buildUUID, getLowercaseExtension } from '@peertube/peertube-node-utils'
import { buildImageSize, processImage, processSVG } from '@server/helpers/image-utils.js'
import { storeCommonFile } from '@server/lib/object-storage/common-files.js'
import { UploadImageModel } from '@server/models/application/upload-image.js'
import { remove } from 'fs-extra/esm'
import { join } from 'path'
import { retryTransactionWrapper } from '../helpers/database-utils.js'
import { CONFIG } from '../initializers/config.js'
import { UPLOAD_IMAGES_SIZE } from '../initializers/constants.js'
import { sequelizeTypescript } from '../initializers/database.js'
import { MActorUploadImages } from '../types/models/index.js'

export async function replaceUploadImage (options: {
  actor: MActorUploadImages
  imagePhysicalFile: { path: string }
  type: UploadImageType_Type
}) {
  const { actor, imagePhysicalFile, type } = options

  // Upload before the transaction is opened
  const processedImages = await generateImageSizesAndUploadIfNeeded(imagePhysicalFile.path, type)
  await remove(imagePhysicalFile.path)

  const storage = CONFIG.OBJECT_STORAGE.UPLOADS.ENABLED
    ? FileStorage.OBJECT_STORAGE
    : FileStorage.FILE_SYSTEM

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
          storage,
          type,
          actorId: actor.id
        }, { transaction: t })

        actor.UploadImages.push(uploadImage)
      }
    })
  )
}

async function generateImageSizesAndUploadIfNeeded (imagePath: string, type: UploadImageType_Type) {
  if (imagePath.endsWith('.svg')) {
    const extension = getLowercaseExtension(imagePath)
    const imageName = buildUUID() + extension
    const destination = buildUploadImageDestination(imageName)

    await processSVG({ path: imagePath, destination })
    await storeUploadImageIfNeeded(destination, imageName)

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
  const destination = buildUploadImageDestination(imageName)

  await processImage({ path: imagePath, destination, newSize: imageSize, keepOriginal: true })
  await storeUploadImageIfNeeded(destination, imageName)

  return { imageName, imageSize }
}

// Generate in tmp when the final destination is object storage
function buildUploadImageDestination (imageName: string) {
  if (CONFIG.OBJECT_STORAGE.UPLOADS.ENABLED) return join(CONFIG.STORAGE.TMP_DIR, imageName)

  return UploadImageModel.getFSPathOf(imageName)
}

async function storeUploadImageIfNeeded (destination: string, imageName: string) {
  if (!CONFIG.OBJECT_STORAGE.UPLOADS.ENABLED) return

  await storeCommonFile('uploads', destination, imageName)
  await remove(destination)
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

        actor.UploadImages = actor.UploadImages.filter(image => image.id !== toDelete.id)
      }
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
