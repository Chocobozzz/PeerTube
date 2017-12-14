import * as Sequelize from 'sequelize'
import { ActivityPubActorType } from '../../shared/models/activitypub'
import { sequelizeTypescript, SERVER_ACTOR_NAME } from '../initializers'
import { AccountModel } from '../models/account/account'
import { UserModel } from '../models/account/user'
import { buildActorInstance, getAccountActivityPubUrl, setAsyncActorKeys } from './activitypub'
import { createVideoChannel } from './video-channel'

async function createUserAccountAndChannel (user: UserModel, validateUser = true) {
  const { account, videoChannel } = await sequelizeTypescript.transaction(async t => {
    const userOptions = {
      transaction: t,
      validate: validateUser
    }

    const userCreated = await user.save(userOptions)
    const accountCreated = await createLocalAccountWithoutKeys(user.username, user.id, null, t)

    const videoChannelName = `Default ${userCreated.username} channel`
    const videoChannelInfo = {
      name: videoChannelName
    }
    const videoChannel = await createVideoChannel(videoChannelInfo, accountCreated, t)

    return { account: accountCreated, videoChannel }
  })

  account.Actor = await setAsyncActorKeys(account.Actor)
  videoChannel.Actor = await setAsyncActorKeys(videoChannel.Actor)

  return { account, videoChannel }
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
    actorId: actorInstanceCreated.id,
    serverId: null // It is our server
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
