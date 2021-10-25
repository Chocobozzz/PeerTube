import { Transaction } from 'sequelize/types'
import { buildUUID } from '@server/helpers/uuid'
import { UserModel } from '@server/models/user/user'
import { MActorDefault } from '@server/types/models/actor'
import { ActivityPubActorType } from '../../shared/models/activitypub'
import { UserNotificationSetting, UserNotificationSettingValue } from '../../shared/models/users'
import { SERVER_ACTOR_NAME, WEBSERVER } from '../initializers/constants'
import { sequelizeTypescript } from '../initializers/database'
import { AccountModel } from '../models/account/account'
import { ActorModel } from '../models/actor/actor'
import { UserNotificationSettingModel } from '../models/user/user-notification-setting'
import { MAccountDefault, MChannelActor } from '../types/models'
import { MUser, MUserDefault, MUserId } from '../types/models/user'
import { generateAndSaveActorKeys } from './activitypub/actors'
import { getLocalAccountActivityPubUrl } from './activitypub/url'
import { Emailer } from './emailer'
import { LiveQuotaStore } from './live/live-quota-store'
import { buildActorInstance } from './local-actor'
import { Redis } from './redis'
import { createLocalVideoChannel } from './video-channel'
import { createWatchLaterPlaylist } from './video-playlist'

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
      t
    })
    userCreated.Account = accountCreated

    const channelAttributes = await buildChannelAttributes(userCreated, t, channelNames)
    const videoChannel = await createLocalVideoChannel(channelAttributes, accountCreated, t)

    const videoPlaylist = await createWatchLaterPlaylist(accountCreated, t)

    return { user: userCreated, account: accountCreated, videoChannel, videoPlaylist }
  })

  const [ accountActorWithKeys, channelActorWithKeys ] = await Promise.all([
    generateAndSaveActorKeys(account.Actor),
    generateAndSaveActorKeys(videoChannel.Actor)
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
  const url = getLocalAccountActivityPubUrl(name)

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

  accountCreated.Actor = await generateAndSaveActorKeys(accountCreated.Actor)

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

async function getOriginalVideoFileTotalFromUser (user: MUserId) {
  // Don't use sequelize because we need to use a sub query
  const query = UserModel.generateUserQuotaBaseSQL({
    withSelect: true,
    whereUserId: '$userId'
  })

  const base = await UserModel.getTotalRawQuery(query, user.id)

  return base + LiveQuotaStore.Instance.getLiveQuotaOf(user.id)
}

// Returns cumulative size of all video files uploaded in the last 24 hours.
async function getOriginalVideoFileTotalDailyFromUser (user: MUserId) {
  // Don't use sequelize because we need to use a sub query
  const query = UserModel.generateUserQuotaBaseSQL({
    withSelect: true,
    whereUserId: '$userId',
    where: '"video"."createdAt" > now() - interval \'24 hours\''
  })

  const base = await UserModel.getTotalRawQuery(query, user.id)

  return base + LiveQuotaStore.Instance.getLiveQuotaOf(user.id)
}

async function isAbleToUploadVideo (userId: number, newVideoSize: number) {
  const user = await UserModel.loadById(userId)

  if (user.videoQuota === -1 && user.videoQuotaDaily === -1) return Promise.resolve(true)

  const [ totalBytes, totalBytesDaily ] = await Promise.all([
    getOriginalVideoFileTotalFromUser(user),
    getOriginalVideoFileTotalDailyFromUser(user)
  ])

  const uploadedTotal = newVideoSize + totalBytes
  const uploadedDaily = newVideoSize + totalBytesDaily

  if (user.videoQuotaDaily === -1) return uploadedTotal < user.videoQuota
  if (user.videoQuota === -1) return uploadedDaily < user.videoQuotaDaily

  return uploadedTotal < user.videoQuota && uploadedDaily < user.videoQuotaDaily
}

// ---------------------------------------------------------------------------

export {
  getOriginalVideoFileTotalFromUser,
  getOriginalVideoFileTotalDailyFromUser,
  createApplicationActor,
  createUserAccountAndChannelAndPlaylist,
  createLocalAccountWithoutKeys,
  sendVerifyUserEmail,
  isAbleToUploadVideo
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
    autoInstanceFollowing: UserNotificationSettingValue.WEB,
    newPeerTubeVersion: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    newPluginVersion: UserNotificationSettingValue.WEB
  }

  return UserNotificationSettingModel.create(values, { transaction: t })
}

async function buildChannelAttributes (user: MUser, transaction?: Transaction, channelNames?: ChannelNames) {
  if (channelNames) return channelNames

  let channelName = user.username + '_channel'

  // Conflict, generate uuid instead
  const actor = await ActorModel.loadLocalByName(channelName, transaction)
  if (actor) channelName = buildUUID()

  const videoChannelDisplayName = `Main ${user.username} channel`

  return {
    name: channelName,
    displayName: videoChannelDisplayName
  }
}
