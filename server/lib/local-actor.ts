import { queue } from 'async'
import { remove } from 'fs-extra'
import LRUCache from 'lru-cache'
import { join } from 'path'
import { ActorModel } from '@server/models/actor/actor'
import { getLowercaseExtension } from '@shared/core-utils'
import { buildUUID } from '@shared/extra-utils'
import { ActivityPubActorType, ActorImageType } from '@shared/models'
import { retryTransactionWrapper } from '../helpers/database-utils'
import { processImage } from '../helpers/image-utils'
import { downloadImage } from '../helpers/requests'
import { CONFIG } from '../initializers/config'
import { ACTOR_IMAGES_SIZE, LRU_CACHE, QUEUE_CONCURRENCY, WEBSERVER } from '../initializers/constants'
import { sequelizeTypescript } from '../initializers/database'
import { MAccountDefault, MActor, MChannelDefault } from '../types/models'
import { deleteActorImages, updateActorImages } from './activitypub/actors'
import { sendUpdateActor } from './activitypub/send'

function buildActorInstance (type: ActivityPubActorType, url: string, preferredUsername: string) {
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

async function updateLocalActorImageFiles (
  accountOrChannel: MAccountDefault | MChannelDefault,
  imagePhysicalFile: Express.Multer.File,
  type: ActorImageType
) {
  const processImageSize = async (imageSize: { width: number, height: number }) => {
    const extension = getLowercaseExtension(imagePhysicalFile.filename)

    const imageName = buildUUID() + extension
    const destination = join(CONFIG.STORAGE.ACTOR_IMAGES, imageName)
    await processImage(imagePhysicalFile.path, destination, imageSize, true)

    return {
      imageName,
      imageSize
    }
  }

  const processedImages = await Promise.all(ACTOR_IMAGES_SIZE[type].map(processImageSize))
  await remove(imagePhysicalFile.path)

  return retryTransactionWrapper(() => sequelizeTypescript.transaction(async t => {
    const actorImagesInfo = processedImages.map(({ imageName, imageSize }) => ({
      name: imageName,
      fileUrl: null,
      height: imageSize.height,
      width: imageSize.width,
      onDisk: true
    }))

    const updatedActor = await updateActorImages(accountOrChannel.Actor, type, actorImagesInfo, t)
    await updatedActor.save({ transaction: t })

    await sendUpdateActor(accountOrChannel, t)

    return type === ActorImageType.AVATAR
      ? updatedActor.Avatars
      : updatedActor.Banners
  }))
}

async function deleteLocalActorImageFile (accountOrChannel: MAccountDefault | MChannelDefault, type: ActorImageType) {
  return retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async t => {
      const updatedActor = await deleteActorImages(accountOrChannel.Actor, type, t)
      await updatedActor.save({ transaction: t })

      await sendUpdateActor(accountOrChannel, t)

      return updatedActor.Avatars
    })
  })
}

type DownloadImageQueueTask = {
  fileUrl: string
  filename: string
  type: ActorImageType
  size: typeof ACTOR_IMAGES_SIZE[ActorImageType][0]
}

const downloadImageQueue = queue<DownloadImageQueueTask, Error>((task, cb) => {
  downloadImage(task.fileUrl, CONFIG.STORAGE.ACTOR_IMAGES, task.filename, task.size)
    .then(() => cb())
    .catch(err => cb(err))
}, QUEUE_CONCURRENCY.ACTOR_PROCESS_IMAGE)

function pushActorImageProcessInQueue (task: DownloadImageQueueTask) {
  return new Promise<void>((res, rej) => {
    downloadImageQueue.push(task, err => {
      if (err) return rej(err)

      return res()
    })
  })
}

// Unsafe so could returns paths that does not exist anymore
const actorImagePathUnsafeCache = new LRUCache<string, string>({ max: LRU_CACHE.ACTOR_IMAGE_STATIC.MAX_SIZE })

export {
  actorImagePathUnsafeCache,
  updateLocalActorImageFiles,
  deleteLocalActorImageFile,
  pushActorImageProcessInQueue,
  buildActorInstance
}
