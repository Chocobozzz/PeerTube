import { minBy } from 'lodash'
import { join } from 'path'
import { getImageSize, processImage } from '@server/helpers/image-utils'
import { CONFIG } from '@server/initializers/config'
import { ACTOR_IMAGES_SIZE } from '@server/initializers/constants'
import { updateActorImages } from '@server/lib/activitypub/actors'
import { sendUpdateActor } from '@server/lib/activitypub/send'
import { getBiggestActorImage } from '@server/lib/actor-image'
import { JobQueue } from '@server/lib/job-queue'
import { AccountModel } from '@server/models/account/account'
import { ActorModel } from '@server/models/actor/actor'
import { VideoChannelModel } from '@server/models/video/video-channel'
import { MAccountDefault, MActorDefault, MChannelDefault } from '@server/types/models'
import { getLowercaseExtension } from '@shared/core-utils'
import { buildUUID } from '@shared/extra-utils'
import { ActorImageType } from '@shared/models'
import { initDatabaseModels } from '../../server/initializers/database'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  console.log('Generate avatar miniatures from existing avatars.')

  await initDatabaseModels(true)
  JobQueue.Instance.init()

  const accounts: AccountModel[] = await AccountModel.findAll({
    include: [
      {
        model: ActorModel,
        required: true,
        where: {
          serverId: null
        }
      },
      {
        model: VideoChannelModel,
        include: [
          {
            model: AccountModel
          }
        ]
      }
    ]
  })

  for (const account of accounts) {
    try {
      await fillAvatarSizeIfNeeded(account)
      await generateSmallerAvatarIfNeeded(account)
    } catch (err) {
      console.error(`Cannot process account avatar ${account.name}`, err)
    }

    for (const videoChannel of account.VideoChannels) {
      try {
        await fillAvatarSizeIfNeeded(videoChannel)
        await generateSmallerAvatarIfNeeded(videoChannel)
      } catch (err) {
        console.error(`Cannot process channel avatar ${videoChannel.name}`, err)
      }
    }
  }

  console.log('Generation finished!')
}

async function fillAvatarSizeIfNeeded (accountOrChannel: MAccountDefault | MChannelDefault) {
  const avatars = accountOrChannel.Actor.Avatars

  for (const avatar of avatars) {
    if (avatar.width && avatar.height) continue

    console.log('Filling size of avatars of %s.', accountOrChannel.name)

    const { width, height } = await getImageSize(join(CONFIG.STORAGE.ACTOR_IMAGES_DIR, avatar.filename))
    avatar.width = width
    avatar.height = height

    await avatar.save()
  }
}

async function generateSmallerAvatarIfNeeded (accountOrChannel: MAccountDefault | MChannelDefault) {
  const avatars = accountOrChannel.Actor.Avatars
  if (avatars.length !== 1) {
    return
  }

  console.log(`Processing ${accountOrChannel.name}.`)

  await generateSmallerAvatar(accountOrChannel.Actor)
  accountOrChannel.Actor = Object.assign(accountOrChannel.Actor, { Server: null })

  return sendUpdateActor(accountOrChannel, undefined)
}

async function generateSmallerAvatar (actor: MActorDefault) {
  const bigAvatar = getBiggestActorImage(actor.Avatars)

  const imageSize = minBy(ACTOR_IMAGES_SIZE[ActorImageType.AVATAR], 'width')
  const sourceFilename = bigAvatar.filename

  const newImageName = buildUUID() + getLowercaseExtension(sourceFilename)
  const source = join(CONFIG.STORAGE.ACTOR_IMAGES_DIR, sourceFilename)
  const destination = join(CONFIG.STORAGE.ACTOR_IMAGES_DIR, newImageName)

  await processImage({ path: source, destination, newSize: imageSize, keepOriginal: true })

  const actorImageInfo = {
    name: newImageName,
    fileUrl: null,
    height: imageSize.height,
    width: imageSize.width,
    onDisk: true
  }

  await updateActorImages(actor, ActorImageType.AVATAR, [ actorImageInfo ], undefined)
}
