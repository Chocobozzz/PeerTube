import { ActivityPubActorType, ActorImageType, ActorImageType_Type, FileStorage, FileStorageType } from '@peertube/peertube-models'
import { buildUUID, getLowercaseExtension } from '@peertube/peertube-node-utils'
import { processImage, processImagesOrCleanup } from '@server/helpers/image-utils.js'
import { storeCommonFile, withLocalCommonFile } from '@server/lib/object-storage/common-files.js'
import { ActorReservedModel } from '@server/models/actor/actor-reserved.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { remove } from 'fs-extra/esm'
import { join } from 'path'
import { Transaction } from 'sequelize'
import { retryTransactionWrapper, runTransaction } from '../helpers/database-utils.js'
import { CONFIG } from '../initializers/config.js'
import { ACTOR_IMAGES_SIZE, WEBSERVER } from '../initializers/constants.js'
import { MAccountDefault, MActor, MChannelDefault } from '../types/models/index.js'
import { deleteActorImages, updateActorImages } from './activitypub/actors/index.js'
import { sendUpdateActor } from './activitypub/send/index.js'

export function buildActorInstance (type: ActivityPubActorType, url: string, preferredUsername: string) {
  return new ActorModel({
    type,
    url,
    preferredUsername,
    publicKey: null,
    privateKey: null,
    followersCount: 0,
    followingCount: 0,
    inboxUrl: url + '/inbox',
    outboxUrl: url + '/outbox',
    sharedInboxUrl: WEBSERVER.URL + '/inbox',
    followersUrl: url + '/followers',
    followingUrl: url + '/following'
  }) as MActor
}

export async function updateLocalActorImageFiles (options: {
  accountOrChannel: MAccountDefault | MChannelDefault
  imagePhysicalFile: { path: string }
  type: ActorImageType_Type
  sendActorUpdate: boolean
}) {
  const { accountOrChannel, imagePhysicalFile, type, sendActorUpdate } = options

  let processedImages: ProcessedActorImage[]

  try {
    // Uploads happen here, before the transaction is opened
    processedImages = await generateActorImageSizes(imagePhysicalFile.path, type)
  } finally {
    await remove(imagePhysicalFile.path)
  }

  return saveLocalActorImages({ accountOrChannel, processedImages, type, sendActorUpdate })
}

export async function deleteLocalActorImageFile (accountOrChannel: MAccountDefault | MChannelDefault, type: ActorImageType_Type) {
  return retryTransactionWrapper(() => {
    return runTransaction(async t => {
      const updatedActor = await deleteActorImages(accountOrChannel.Actor, type, t)
      await updatedActor.save({ transaction: t })

      await sendUpdateActor(accountOrChannel, t)

      return updatedActor.Avatars
    })
  })
}

export async function regenerateActorImageFiles (options: {
  accountOrChannel: MAccountDefault | MChannelDefault
  type: ActorImageType_Type
}) {
  const { accountOrChannel, type } = options

  if (accountOrChannel.Actor.isLocal() !== true) {
    throw new Error('Cannot regenerate actor image files for a remote actor')
  }

  const image = accountOrChannel.Actor.getMaxQualityImage(type)
  if (!image) return

  return withLocalCommonFile('avatars', image, async physicalFilePath => {
    // Keep the original image if generation fails, since it is still used by the actor
    const processedImages = await generateActorImageSizes(physicalFilePath, type)
    await remove(physicalFilePath)

    return saveLocalActorImages({ accountOrChannel, processedImages, type, sendActorUpdate: true })
  })
}

// ---------------------------------------------------------------------------

export async function findAvailableLocalActorName (baseName: string, transaction?: Transaction) {
  let actor = await loadReservedActorName(baseName, transaction)
  if (!actor) return baseName

  for (let i = 1; i < 30; i++) {
    const name = `${baseName}-${i}`

    actor = await loadReservedActorName(name, transaction)
    if (!actor) return name
  }

  throw new Error('Cannot find available actor local name (too much iterations).')
}

export async function loadReservedActorName (baseName: string, transaction?: Transaction) {
  return await ActorModel.loadLocalByName(baseName, transaction) ?? await ActorReservedModel.loadByName(baseName, transaction)
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

type ProcessedActorImage = { imageName: string, imageSize: { width: number, height: number }, storage: FileStorageType }

async function generateActorImageSizes (path: string, type: ActorImageType_Type): Promise<ProcessedActorImage[]> {
  const extension = getLowercaseExtension(path)
  const onObjectStorage = CONFIG.OBJECT_STORAGE.ENABLED

  const generated = await processImagesOrCleanup(ACTOR_IMAGES_SIZE[type].map(imageSize => {
    const imageName = buildUUID() + extension

    // Generate in tmp when the final destination is object storage
    const destination = join(onObjectStorage ? CONFIG.STORAGE.TMP_DIR : CONFIG.STORAGE.ACTOR_IMAGES_DIR, imageName)

    return {
      destination,
      process: async () => {
        await processImage({ path, destination, newSize: imageSize, keepOriginal: true })

        return { imageName, imageSize, destination }
      }
    }
  }))

  if (onObjectStorage) {
    // Upload only when all sizes have been generated, so an invalid image doesn't leave orphan objects
    try {
      await Promise.all(generated.map(({ imageName, destination }) => storeCommonFile('avatars', destination, imageName)))
    } finally {
      await Promise.all(generated.map(({ destination }) => remove(destination)))
    }
  }

  return generated.map(({ imageName, imageSize }) => ({
    imageName,
    imageSize,
    storage: onObjectStorage
      ? FileStorage.OBJECT_STORAGE
      : FileStorage.FILE_SYSTEM
  }))
}

function saveLocalActorImages (options: {
  accountOrChannel: MAccountDefault | MChannelDefault
  processedImages: ProcessedActorImage[]
  type: ActorImageType_Type
  sendActorUpdate: boolean
}) {
  const { accountOrChannel, processedImages, type, sendActorUpdate } = options

  return retryTransactionWrapper(() =>
    runTransaction(async t => {
      const actorImagesInfo = processedImages.map(({ imageName, imageSize, storage }) => ({
        name: imageName,
        fileUrl: null,
        height: imageSize.height,
        width: imageSize.width,
        cached: false,
        storage
      }))

      const updatedActor = await updateActorImages(accountOrChannel.Actor, type, actorImagesInfo, t)
      await updatedActor.save({ transaction: t })

      if (sendActorUpdate) {
        await sendUpdateActor(accountOrChannel, t)
      }

      return type === ActorImageType.AVATAR
        ? updatedActor.Avatars
        : updatedActor.Banners
    })
  )
}
