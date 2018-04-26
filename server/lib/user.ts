import * as Sequelize from 'sequelize'
import { ActivityPubActorType } from '../../shared/models/activitypub'
import { sequelizeTypescript, SERVER_ACTOR_NAME } from '../initializers'
import { AccountModel } from '../models/account/account'
import { UserModel } from '../models/account/user'
import { buildActorInstance, getAccountActivityPubUrl, setAsyncActorKeys } from './activitypub'
import { createVideoChannel } from './video-channel'
import { VideoChannelModel } from '../models/video/video-channel'

async function createUserAccountAndChannel (userToCreate: UserModel, validateUser = true) {
  const { user, account, videoChannel } = await sequelizeTypescript.transaction(async t => {
    const userOptions = {
      transaction: t,
      validate: validateUser
    }

    const userCreated = await userToCreate.save(userOptions)
    const accountCreated = await createLocalAccountWithoutKeys(userToCreate.username, userToCreate.id, null, t)

    const videoChannelDisplayName = `Default ${userCreated.username} channel`
    const videoChannelInfo = {
      displayName: videoChannelDisplayName
    }
    const videoChannel = await createVideoChannel(videoChannelInfo, accountCreated, t)

    return { user: userCreated, account: accountCreated, videoChannel }
  })

  account.Actor = await setAsyncActorKeys(account.Actor)
  videoChannel.Actor = await setAsyncActorKeys(videoChannel.Actor)

  return { user, account, videoChannel } as { user: UserModel, account: AccountModel, videoChannel: VideoChannelModel }
}

async function createLocalAccountWithoutKeys (
  name: string,
  userId: number,
  applicationId: number,
  t: Sequelize.Transaction,
  type: ActivityPubActorType= 'Person'
) {
  const url = getAccountActivityPubUrl(name)

  const actorInstance = buildActorInstance(type, url, name)
  const actorInstanceCreated = await actorInstance.save({ transaction: t })

  const accountInstance = new AccountModel({
    name,
    userId,
    applicationId,
    actorId: actorInstanceCreated.id
  })

  const accountInstanceCreated = await accountInstance.save({ transaction: t })
  accountInstanceCreated.Actor = actorInstanceCreated

  return accountInstanceCreated
}

async function createApplicationActor (applicationId: number) {
  const accountCreated = await createLocalAccountWithoutKeys(SERVER_ACTOR_NAME, null, applicationId, undefined, 'Application')

  accountCreated.Actor = await setAsyncActorKeys(accountCreated.Actor)

  return accountCreated
}

// ---------------------------------------------------------------------------

export {
  createApplicationActor,
  createUserAccountAndChannel,
  createLocalAccountWithoutKeys
}
