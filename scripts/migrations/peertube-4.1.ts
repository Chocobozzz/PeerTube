import { initDatabaseModels } from '../../server/initializers/database'
import { AccountModel } from '@server/models/account/account'
import { ActorModel } from '@server/models/actor/actor'
import { VideoChannelModel } from '@server/models/video/video-channel'
import { MAccountDefault, MActorImages, MChannelDefault } from '@server/types/models'
import { JobQueue } from '@server/lib/job-queue'
import { generateAvatarMini } from '@server/lib/local-actor'
import { sendUpdateActor } from '@server/lib/activitypub/send'
import { Transaction } from 'sequelize/types'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  console.log('Generate avatar miniatures from existing avatars.')

  await initDatabaseModels(true)
  JobQueue.Instance.init(true)

  const accounts: AccountModel[] = await AccountModel.findAll({
    include: [
      {
        model: ActorModel.scope('FULL'),
        where: {
          serverId: null
        }
      },
      {
        model: VideoChannelModel,
        include: [
          {
            model: ActorModel
          },
          {
            model: AccountModel
          }
        ]
      }
    ]
  })

  for (const account of accounts) {
    console.log(`Processing account ${account.name} and it's ${account.VideoChannels.length} video channnels.`)
    await generateAvatarMiniIfNeeded(account)

    for (const videoChannel of account.VideoChannels) {
      await generateAvatarMiniIfNeeded(videoChannel)
    }
  }

  console.log('Generation finished!')
}

async function generateAvatarMiniIfNeeded (accountOrChannel: MAccountDefault | MChannelDefault) {
  if (!accountOrChannel.Actor.Avatar || accountOrChannel.Actor.AvatarMini) {
    return
  }

  await generateAvatarMini(accountOrChannel.Actor, (t: Transaction, updateActor: MActorImages) => {
    accountOrChannel.Actor = Object.assign(updateActor, { Server: accountOrChannel.Actor.Server })
    return sendUpdateActor(accountOrChannel, t)
  })
}
