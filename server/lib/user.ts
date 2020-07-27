import { v4 as uuidv4 } from 'uuid'
import { ActivityPubActorType } from '../../shared/models/activitypub'
import { SERVER_ACTOR_NAME, WEBSERVER } from '../initializers/constants'
import { AccountModel } from '../models/account/account'
import { buildActorInstance, setAsyncActorKeys } from './activitypub/actor'
import { createLocalVideoChannel } from './video-channel'
import { ActorModel } from '../models/activitypub/actor'
import { UserNotificationSettingModel } from '../models/account/user-notification-setting'
import { UserNotificationSetting, UserNotificationSettingValue } from '../../shared/models/users'
import { createWatchLaterPlaylist } from './video-playlist'
import { sequelizeTypescript } from '../initializers/database'
import { Transaction } from 'sequelize/types'
import { Redis } from './redis'
import { Emailer } from './emailer'
import { MAccountDefault, MActorDefault, MChannelActor } from '../types/models'
import { MUser, MUserDefault, MUserId } from '../types/models/user'
import { getAccountActivityPubUrl } from './activitypub/url'

type ChannelNames = { name: string, displayName: string }

async function createUserAccountAndChannelAndPlaylist (parameters: {
  userToCreate: MUser
  userDisplayName?: string
  channelNames?: ChannelNames
  validateUser?: boolean
}): Promise<{ user: MUserDefault, account: MAccountDefault, videoChannel: MChannelActor }> {
  const { userToCreate, userDisplayName, channelNames, validateUser = true } = parameters

  const { user, account, videoChannel } = await sequelizeTypescript.transaction(async t => {
    const userOptions = {
      transaction: t,
      validate: validateUser
    }

    const userCreated: MUserDefault = await userToCreate.save(userOptions)
    userCreated.NotificationSetting = await createDefaultUserNotificationSettings(userCreated, t)

    const accountCreated = await createLocalAccountWithoutKeys({
      name: userCreated.username,
      displayName: userDisplayName,
      userId: userCreated.id,
      applicationId: null,
      t: t
    })
    userCreated.Account = accountCreated

    const channelAttributes = await buildChannelAttributes(userCreated, channelNames)
    const videoChannel = await createLocalVideoChannel(channelAttributes, accountCreated, t)

    const videoPlaylist = await createWatchLaterPlaylist(accountCreated, t)

    return { user: userCreated, account: accountCreated, videoChannel, videoPlaylist }
  })

  const [ accountActorWithKeys, channelActorWithKeys ] = await Promise.all([
    setAsyncActorKeys(account.Actor),
    setAsyncActorKeys(videoChannel.Actor)
  ])

  account.Actor = accountActorWithKeys
  videoChannel.Actor = channelActorWithKeys

  return { user, account, videoChannel }
}

async function createLocalAccountWithoutKeys (parameters: {
  name: string
  displayName?: string
  userId: number | null
  applicationId: number | null
  t: Transaction | undefined
  type?: ActivityPubActorType
}) {
  const { name, displayName, userId, applicationId, t, type = 'Person' } = parameters
  const url = getAccountActivityPubUrl(name)

  const actorInstance = buildActorInstance(type, url, name)
  const actorInstanceCreated: MActorDefault = await actorInstance.save({ transaction: t })

  const accountInstance = new AccountModel({
    name: displayName || name,
    userId,
    applicationId,
    actorId: actorInstanceCreated.id
  })

  const accountInstanceCreated: MAccountDefault = await accountInstance.save({ transaction: t })
  accountInstanceCreated.Actor = actorInstanceCreated

  return accountInstanceCreated
}

async function createApplicationActor (applicationId: number) {
  const accountCreated = await createLocalAccountWithoutKeys({
    name: SERVER_ACTOR_NAME,
    userId: null,
    applicationId: applicationId,
    t: undefined,
    type: 'Application'
  })

  accountCreated.Actor = await setAsyncActorKeys(accountCreated.Actor)

  return accountCreated
}

async function sendVerifyUserEmail (user: MUser, isPendingEmail = false) {
  const verificationString = await Redis.Instance.setVerifyEmailVerificationString(user.id)
  let url = WEBSERVER.URL + '/verify-account/email?userId=' + user.id + '&verificationString=' + verificationString

  if (isPendingEmail) url += '&isPendingEmail=true'

  const email = isPendingEmail ? user.pendingEmail : user.email
  const username = user.username

  await Emailer.Instance.addVerifyEmailJob(username, email, url)
}

// ---------------------------------------------------------------------------

export {
  createApplicationActor,
  createUserAccountAndChannelAndPlaylist,
  createLocalAccountWithoutKeys,
  sendVerifyUserEmail
}

// ---------------------------------------------------------------------------

function createDefaultUserNotificationSettings (user: MUserId, t: Transaction | undefined) {
  const values: UserNotificationSetting & { userId: number } = {
    userId: user.id,
    newVideoFromSubscription: UserNotificationSettingValue.WEB,
    newCommentOnMyVideo: UserNotificationSettingValue.WEB,
    myVideoImportFinished: UserNotificationSettingValue.WEB,
    myVideoPublished: UserNotificationSettingValue.WEB,
    abuseAsModerator: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    videoAutoBlacklistAsModerator: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    blacklistOnMyVideo: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    newUserRegistration: UserNotificationSettingValue.WEB,
    commentMention: UserNotificationSettingValue.WEB,
    newFollow: UserNotificationSettingValue.WEB,
    newInstanceFollower: UserNotificationSettingValue.WEB,
    abuseNewMessage: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    abuseStateChange: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    autoInstanceFollowing: UserNotificationSettingValue.WEB
  }

  return UserNotificationSettingModel.create(values, { transaction: t })
}

async function buildChannelAttributes (user: MUser, channelNames?: ChannelNames) {
  if (channelNames) return channelNames

  let channelName = user.username + '_channel'

  // Conflict, generate uuid instead
  const actor = await ActorModel.loadLocalByName(channelName)
  if (actor) channelName = uuidv4()

  const videoChannelDisplayName = `Main ${user.username} channel`

  return {
    name: channelName,
    displayName: videoChannelDisplayName
  }
}
