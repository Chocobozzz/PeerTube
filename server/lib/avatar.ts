import 'multer'
import { sendUpdateActor } from './activitypub/send'
import { AVATARS_SIZE, LRU_CACHE, QUEUE_CONCURRENCY } from '../initializers/constants'
import { updateActorAvatarInstance } from './activitypub/actor'
import { processImage } from '../helpers/image-utils'
import { extname, join } from 'path'
import { retryTransactionWrapper } from '../helpers/database-utils'
import { v4 as uuidv4 } from 'uuid'
import { CONFIG } from '../initializers/config'
import { sequelizeTypescript } from '../initializers/database'
import * as LRUCache from 'lru-cache'
import { queue } from 'async'
import { downloadImage } from '../helpers/requests'
import { MAccountDefault, MChannelDefault } from '../types/models'

async function updateActorAvatarFile (
  avatarPhysicalFile: Express.Multer.File,
  accountOrChannel: MAccountDefault | MChannelDefault
) {
  const extension = extname(avatarPhysicalFile.filename)
  const avatarName = uuidv4() + extension
  const destination = join(CONFIG.STORAGE.AVATARS_DIR, avatarName)
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

type DownloadImageQueueTask = { fileUrl: string, filename: string }

const downloadImageQueue = queue<DownloadImageQueueTask, Error>((task, cb) => {
  downloadImage(task.fileUrl, CONFIG.STORAGE.AVATARS_DIR, task.filename, AVATARS_SIZE)
    .then(() => cb())
    .catch(err => cb(err))
}, QUEUE_CONCURRENCY.AVATAR_PROCESS_IMAGE)

function pushAvatarProcessInQueue (task: DownloadImageQueueTask) {
  return new Promise((res, rej) => {
    downloadImageQueue.push(task, err => {
      if (err) return rej(err)

      return res()
    })
  })
}

// Unsafe so could returns paths that does not exist anymore
const avatarPathUnsafeCache = new LRUCache<string, string>({ max: LRU_CACHE.AVATAR_STATIC.MAX_SIZE })

export {
  avatarPathUnsafeCache,
  updateActorAvatarFile,
  pushAvatarProcessInQueue
}
