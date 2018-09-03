import 'multer'
import { sendUpdateActor } from './activitypub/send'
import { AVATARS_SIZE, CONFIG, sequelizeTypescript } from '../initializers'
import { updateActorAvatarInstance } from './activitypub'
import { processImage } from '../helpers/image-utils'
import { ActorModel } from '../models/activitypub/actor'
import { AccountModel } from '../models/account/account'
import { VideoChannelModel } from '../models/video/video-channel'
import { extname, join } from 'path'

async function updateActorAvatarFile (
  avatarPhysicalFile: Express.Multer.File,
  actor: ActorModel,
  accountOrChannel: AccountModel | VideoChannelModel
) {
  const extension = extname(avatarPhysicalFile.filename)
  const avatarName = actor.uuid + extension
  const destination = join(CONFIG.STORAGE.AVATARS_DIR, avatarName)
  await processImage(avatarPhysicalFile, destination, AVATARS_SIZE)

  return sequelizeTypescript.transaction(async t => {
    const updatedActor = await updateActorAvatarInstance(actor, avatarName, t)
    await updatedActor.save({ transaction: t })

    await sendUpdateActor(accountOrChannel, t)

    return updatedActor.Avatar
  })
}

export {
  updateActorAvatarFile
}
