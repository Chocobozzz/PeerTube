import * as Sequelize from 'sequelize'
import * as uuidv4 from 'uuid/v4'
import { ActivityPubActorType } from '../../shared/models/activitypub'
import { sequelizeTypescript, SERVER_ACTOR_NAME } from '../initializers'
import { AccountModel } from '../models/account/account'
import { UserModel } from '../models/account/user'
import { buildActorInstance, getAccountActivityPubUrl, setAsyncActorKeys } from './activitypub'
import { createVideoChannel } from './video-channel'
import { VideoChannelModel } from '../models/video/video-channel'
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model'
import { ActorModel } from '../models/activitypub/actor'
import { UserNotificationSettingModel } from '../models/account/user-notification-setting'
import { UserNotificationSetting, UserNotificationSettingValue } from '../../shared/models/users'
import { createWatchLaterPlaylist } from './video-playlist'

async function createUserAccountAndChannelAndPlaylist (userToCreate: UserModel, validateUser = true) {
  const { user, account, videoChannel } = await sequelizeTypescript.transaction(async t => {
    const userOptions = {
      transaction: t,
      validate: validateUser
    }

    const userCreated = await userToCreate.save(userOptions)
    userCreated.NotificationSetting = await createDefaultUserNotificationSettings(userCreated, t)

    const accountCreated = await createLocalAccountWithoutKeys(userCreated.username, userCreated.id, null, t)
    userCreated.Account = accountCreated

    let channelName = userCreated.username + '_channel'

    // Conflict, generate uuid instead
    const actor = await ActorModel.loadLocalByName(channelName)
    if (actor) channelName = uuidv4()

    const videoChannelDisplayName = `Main ${userCreated.username} channel`
    const videoChannelInfo = {
      name: channelName,
      displayName: videoChannelDisplayName
    }
    const videoChannel = await createVideoChannel(videoChannelInfo, accountCreated, t)

    const videoPlaylist = await createWatchLaterPlaylist(accountCreated, t)

    return { user: userCreated, account: accountCreated, videoChannel, videoPlaylist }
  })

  const [ accountKeys, channelKeys ] = await Promise.all([
    setAsyncActorKeys(account.Actor),
    setAsyncActorKeys(videoChannel.Actor)
  ])

  account.Actor = accountKeys
  videoChannel.Actor = channelKeys

  return { user, account, videoChannel } as { user: UserModel, account: AccountModel, videoChannel: VideoChannelModel }
}

async function createLocalAccountWithoutKeys (
  name: string,
  userId: number | null,
  applicationId: number | null,
  t: Sequelize.Transaction | undefined,
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
  } as FilteredModelAttributes<AccountModel>)

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
  createUserAccountAndChannelAndPlaylist,
  createLocalAccountWithoutKeys
}

// ---------------------------------------------------------------------------

function createDefaultUserNotificationSettings (user: UserModel, t: Sequelize.Transaction | undefined) {
  const values: UserNotificationSetting & { userId: number } = {
    userId: user.id,
    newVideoFromSubscription: UserNotificationSettingValue.WEB,
    newCommentOnMyVideo: UserNotificationSettingValue.WEB,
    myVideoImportFinished: UserNotificationSettingValue.WEB,
    myVideoPublished: UserNotificationSettingValue.WEB,
    videoAbuseAsModerator: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    videoAutoBlacklistAsModerator: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    blacklistOnMyVideo: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    newUserRegistration: UserNotificationSettingValue.WEB,
    commentMention: UserNotificationSettingValue.WEB,
    newFollow: UserNotificationSettingValue.WEB
  }

  return UserNotificationSettingModel.create(values, { transaction: t })
}
