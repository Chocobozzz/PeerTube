import { FileStorage, LogoType, UploadImageType, UploadImageType_Type } from '@peertube/peertube-models'
import { buildUUID, getLowercaseExtension } from '@peertube/peertube-node-utils'
import { buildImageSize, processImage, processImagesOrCleanup, processSVG } from '@server/helpers/image-utils.js'
import { storeCommonFile } from '@server/lib/object-storage/common-files.js'
import { UploadImageModel } from '@server/models/application/upload-image.js'
import { remove } from 'fs-extra/esm'
import { join } from 'path'
import { retryTransactionWrapper, runTransaction } from '../helpers/database-utils.js'
import { CONFIG } from '../initializers/config.js'
import { UPLOAD_IMAGES_SIZE } from '../initializers/constants.js'
import { MActorUploadImages } from '../types/models/index.js'

type ProcessedUploadImage = { imageName: string, imageSize: { width: number, height: number } }

export async function replaceUploadImage (options: {
  actor: MActorUploadImages
  imagePhysicalFile: { path: string }
  type: UploadImageType_Type
}) {
  const { actor, imagePhysicalFile, type } = options

  let processedImages: ProcessedUploadImage[]

  try {
    // Upload before the transaction is opened
    processedImages = await generateImageSizesAndUploadIfNeeded(imagePhysicalFile.path, type)
  } finally {
    await remove(imagePhysicalFile.path)
  }

  const storage = CONFIG.OBJECT_STORAGE.ENABLED
    ? FileStorage.OBJECT_STORAGE
    : FileStorage.FILE_SYSTEM

  return retryTransactionWrapper(() =>
    runTransaction(async t => {
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

async function generateImageSizesAndUploadIfNeeded (imagePath: string, type: UploadImageType_Type): Promise<ProcessedUploadImage[]> {
  const generated = await generateImageSizes(imagePath, type)

  if (CONFIG.OBJECT_STORAGE.ENABLED) {
    // Upload only when all sizes have been generated, so an invalid image doesn't leave orphan objects
    try {
      await Promise.all(generated.map(({ imageName, destination }) => storeCommonFile('uploads', destination, imageName)))
    } finally {
      await Promise.all(generated.map(({ destination }) => remove(destination)))
    }
  }

  return generated.map(({ imageName, imageSize }) => ({ imageName, imageSize }))
}

async function generateImageSizes (
  imagePath: string,
  type: UploadImageType_Type
): Promise<(ProcessedUploadImage & { destination: string })[]> {
  const extension = getLowercaseExtension(imagePath)

  if (imagePath.endsWith('.svg')) {
    const imageName = buildUUID() + extension
    const destination = buildUploadImageDestination(imageName)

    await processSVG({ path: imagePath, destination })

    return [ { imageName, imageSize: { width: null, height: null }, destination } ]
  }

  return processImagesOrCleanup(UPLOAD_IMAGES_SIZE[type].map(({ width, height }) => {
    const imageName = buildUUID() + extension
    const destination = buildUploadImageDestination(imageName)

    return {
      destination,
      process: async () => {
        const imageSize = await buildImageSize(imagePath, { width, height })

        await processImage({ path: imagePath, destination, newSize: imageSize, keepOriginal: true })

        return { imageName, imageSize, destination }
      }
    }
  }))
}

// Generate in tmp when the final destination is object storage
function buildUploadImageDestination (imageName: string) {
  if (CONFIG.OBJECT_STORAGE.ENABLED) return join(CONFIG.STORAGE.TMP_DIR, imageName)

  return UploadImageModel.getFSPathOf(imageName)
}

// ---------------------------------------------------------------------------

export async function deleteUploadImages (options: {
  actor: MActorUploadImages
  type: UploadImageType_Type
}) {
  const { actor, type } = options

  return retryTransactionWrapper(() => {
    return runTransaction(async t => {
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
