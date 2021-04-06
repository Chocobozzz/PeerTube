import 'multer'
import { queue } from 'async'
import * as LRUCache from 'lru-cache'
import { extname, join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { retryTransactionWrapper } from '../helpers/database-utils'
import { processImage } from '../helpers/image-utils'
import { downloadImage } from '../helpers/requests'
import { CONFIG } from '../initializers/config'
import { AVATARS_SIZE, LRU_CACHE, QUEUE_CONCURRENCY } from '../initializers/constants'
import { sequelizeTypescript } from '../initializers/database'
import { MAccountDefault, MChannelDefault } from '../types/models'
import { deleteActorAvatarInstance, updateActorAvatarInstance } from './activitypub/actor'
import { sendUpdateActor } from './activitypub/send'

async function updateLocalActorAvatarFile (
  accountOrChannel: MAccountDefault | MChannelDefault,
  avatarPhysicalFile: Express.Multer.File
) {
  const extension = extname(avatarPhysicalFile.filename)

  const avatarName = uuidv4() + extension
  const destination = join(CONFIG.STORAGE.ACTOR_IMAGES, avatarName)
  await processImage(avatarPhysicalFile.path, destination, AVATARS_SIZE)

  return retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async t => {
      const avatarInfo = {
        name: avatarName,
        fileUrl: null,
        onDisk: true
      }

      const updatedActor = await updateActorAvatarInstance(accountOrChannel.Actor, avatarInfo, t)
      await updatedActor.save({ transaction: t })

      await sendUpdateActor(accountOrChannel, t)

      return updatedActor.Avatar
    })
  })
}

async function deleteLocalActorAvatarFile (
  accountOrChannel: MAccountDefault | MChannelDefault
) {
  return retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async t => {
      const updatedActor = await deleteActorAvatarInstance(accountOrChannel.Actor, t)
      await updatedActor.save({ transaction: t })

      await sendUpdateActor(accountOrChannel, t)

      return updatedActor.Avatar
    })
  })
}

type DownloadImageQueueTask = { fileUrl: string, filename: string }

const downloadImageQueue = queue<DownloadImageQueueTask, Error>((task, cb) => {
  downloadImage(task.fileUrl, CONFIG.STORAGE.ACTOR_IMAGES, task.filename, AVATARS_SIZE)
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
  updateLocalActorAvatarFile,
  deleteLocalActorAvatarFile,
  pushActorImageProcessInQueue
}
