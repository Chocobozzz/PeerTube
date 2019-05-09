import 'multer'
import { sendUpdateActor } from './activitypub/send'
import { AVATARS_SIZE } from '../initializers/constants'
import { updateActorAvatarInstance } from './activitypub'
import { processImage } from '../helpers/image-utils'
import { AccountModel } from '../models/account/account'
import { VideoChannelModel } from '../models/video/video-channel'
import { extname, join } from 'path'
import { retryTransactionWrapper } from '../helpers/database-utils'
import * as uuidv4 from 'uuid/v4'
import { CONFIG } from '../initializers/config'
import { sequelizeTypescript } from '../initializers/database'

async function updateActorAvatarFile (avatarPhysicalFile: Express.Multer.File, accountOrChannel: AccountModel | VideoChannelModel) {
  const extension = extname(avatarPhysicalFile.filename)
  const avatarName = uuidv4() + extension
  const destination = join(CONFIG.STORAGE.AVATARS_DIR, avatarName)
  await processImage(avatarPhysicalFile.path, destination, AVATARS_SIZE)

  return retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async t => {
      const updatedActor = await updateActorAvatarInstance(accountOrChannel.Actor, avatarName, t)
      await updatedActor.save({ transaction: t })

      await sendUpdateActor(accountOrChannel, t)

      return updatedActor.Avatar
    })
  })
}

export {
  updateActorAvatarFile
}
