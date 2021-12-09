import 'multer'
import { queue } from 'async'
import LRUCache from 'lru-cache'
import { join } from 'path'
import { remove } from 'fs-extra'
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
import { MAccountDefault, MActor, MActorDefault, MActorImages, MChannelDefault } from '../types/models'
import { deleteActorImageInstance, updateActorImageInstance } from './activitypub/actors'
import { sendUpdateActor } from './activitypub/send'
import { Transaction } from 'sequelize/types'
import { logger } from '@server/helpers/logger'

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

async function updateLocalActorImagesFile (
  accountOrChannel: MAccountDefault | MChannelDefault,
  imagePhysicalFile: Express.Multer.File,
  types: ActorImageType[]
) {
  const results = await Promise.all(types.map(async type => {
    const imageSize = ACTOR_IMAGES_SIZE[type]
    const extension = getLowercaseExtension(imagePhysicalFile.filename)

    const imageName = buildUUID() + extension
    const destination = join(CONFIG.STORAGE.ACTOR_IMAGES, imageName)
    await processImage(imagePhysicalFile.path, destination, imageSize, true)

    return {
      imageName,
      imageSize,
      type
    }
  }))

  await remove(imagePhysicalFile.path)

  return retryTransactionWrapper(() => sequelizeTypescript.transaction(async t =>
    Promise.all(results.map(async ({ imageName, imageSize, type }) => {
      const actorImageInfo = {
        name: imageName,
        fileUrl: null,
        height: imageSize.height,
        width: imageSize.width,
        onDisk: true
      }

      const updatedActor = await updateActorImageInstance(accountOrChannel.Actor, type, actorImageInfo, t)
      await updatedActor.save({ transaction: t })

      await sendUpdateActor(accountOrChannel, t)

      return type === ActorImageType.AVATAR
        ? updatedActor.Avatar
        : type === ActorImageType.AVATAR_MINIATURE
          ? updatedActor.AvatarMini
          : updatedActor.Banner
    }))
  ))
}

async function deleteLocalActorImageFile (accountOrChannel: MAccountDefault | MChannelDefault, type: ActorImageType) {
  return retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async t => {
      const updatedActor = await deleteActorImageInstance(accountOrChannel.Actor, type, t)
      await updatedActor.save({ transaction: t })

      await sendUpdateActor(accountOrChannel, t)

      return updatedActor.Avatar
    })
  })
}

type DownloadImageQueueTask = { fileUrl: string, filename: string, type: ActorImageType }

const downloadImageQueue = queue<DownloadImageQueueTask, Error>((task, cb) => {
  const size = ACTOR_IMAGES_SIZE[task.type]

  downloadImage(task.fileUrl, CONFIG.STORAGE.ACTOR_IMAGES, task.filename, size)
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

async function generateAvatarMini
(Actor: MActorDefault, afterCb?: (t: Transaction, updateActor: MActorImages) => Promise<any>, transaction?: Transaction) {
  if (Actor.Avatar.onDisk === false) {
    try {
      await pushActorImageProcessInQueue({ filename: Actor.Avatar.filename, fileUrl: Actor.Avatar.fileUrl, type: Actor.Avatar.type })
    } catch (err) {
      logger.warn('Cannot process remote actor image %s.', Actor.Avatar.fileUrl, { err })

      throw err
    }

    Actor.Avatar.onDisk = true
    Actor.Avatar.save()
      .catch(err => logger.error('Cannot save new actor image disk state.', { err }))
  }

  const imageSize = ACTOR_IMAGES_SIZE[ActorImageType.AVATAR_MINIATURE]
  const sourceFilename = Actor.Avatar.filename
  const extension = getLowercaseExtension(sourceFilename)

  const imageName = buildUUID() + extension
  const source = join(CONFIG.STORAGE.ACTOR_IMAGES, sourceFilename)
  const destination = join(CONFIG.STORAGE.ACTOR_IMAGES, imageName)
  await processImage(source, destination, imageSize, true)

  return retryTransactionWrapper(async () => {
    const save = async t => {
      const actorImageInfo = {
        name: imageName,
        fileUrl: null,
        height: imageSize.height,
        width: imageSize.width,
        onDisk: true
      }

      const updatedActor = await updateActorImageInstance(Actor, ActorImageType.AVATAR_MINIATURE, actorImageInfo, t)

      if (!transaction) {
        await updatedActor.save({ transaction: t })
      }

      if (afterCb) {
        await afterCb(t, updatedActor)
      }
    }

    if (transaction) {
      await save(transaction)
    } else {
      await sequelizeTypescript.transaction(save)
    }
  })
}

export {
  actorImagePathUnsafeCache,
  updateLocalActorImagesFile as updateLocalActorImageFile,
  deleteLocalActorImageFile,
  pushActorImageProcessInQueue,
  buildActorInstance,
  generateAvatarMini
}
