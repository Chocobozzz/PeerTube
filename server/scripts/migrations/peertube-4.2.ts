import { maxBy, minBy } from '@peertube/peertube-core-utils'
import { ActorImageType } from '@peertube/peertube-models'
import { buildUUID, getLowercaseExtension } from '@peertube/peertube-node-utils'
import { getImageSize, processImage } from '@server/helpers/image-utils.js'
import { CONFIG } from '@server/initializers/config.js'
import { ACTOR_IMAGES_SIZE } from '@server/initializers/constants.js'
import { initDatabaseModels } from '@server/initializers/database.js'
import { updateActorImages } from '@server/lib/activitypub/actors/index.js'
import { sendUpdateActor } from '@server/lib/activitypub/send/index.js'
import { JobQueue } from '@server/lib/job-queue/index.js'
import { AccountModel } from '@server/models/account/account.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { MAccountDefault, MActorDefault, MChannelDefault } from '@server/types/models/index.js'
import { join } from 'path'

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
  const bigAvatar = maxBy(actor.Avatars, 'width')

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
