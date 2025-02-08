import { Transaction } from 'sequelize'
import {
  ActivityPubActorType,
  UserAdminFlag,
  UserAdminFlagType,
  UserNotificationSetting,
  UserNotificationSettingValue,
  UserRole,
  UserRoleType
} from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { UserModel } from '@server/models/user/user.js'
import { MActorDefault } from '@server/types/models/actor/index.js'
import { SERVER_ACTOR_NAME, WEBSERVER } from '../initializers/constants.js'
import { sequelizeTypescript } from '../initializers/database.js'
import { AccountModel } from '../models/account/account.js'
import { UserNotificationSettingModel } from '../models/user/user-notification-setting.js'
import { MAccountDefault, MChannelActor } from '../types/models/index.js'
import { MRegistration, MUser, MUserDefault, MUserId } from '../types/models/user/index.js'
import { generateAndSaveActorKeys } from './activitypub/actors/index.js'
import { getLocalAccountActivityPubUrl } from './activitypub/url.js'
import { Emailer } from './emailer.js'
import { LiveQuotaStore } from './live/live-quota-store.js'
import { buildActorInstance, findAvailableLocalActorName } from './local-actor.js'
import { Redis } from './redis.js'
import { createLocalVideoChannelWithoutKeys } from './video-channel.js'
import { createWatchLaterPlaylist } from './video-playlist.js'

type ChannelNames = { name: string, displayName: string }

function buildUser (options: {
  username: string
  password: string
  email: string

  role?: UserRoleType // Default to UserRole.User
  adminFlags?: UserAdminFlagType // Default to UserAdminFlag.NONE

  emailVerified: boolean | null

  videoQuota?: number // Default to CONFIG.USER.VIDEO_QUOTA
  videoQuotaDaily?: number // Default to CONFIG.USER.VIDEO_QUOTA_DAILY

  pluginAuth?: string
}): MUser {
  const {
    username,
    password,
    email,
    role = UserRole.USER,
    emailVerified,
    videoQuota = CONFIG.USER.VIDEO_QUOTA,
    videoQuotaDaily = CONFIG.USER.VIDEO_QUOTA_DAILY,
    adminFlags = UserAdminFlag.NONE,
    pluginAuth
  } = options

  return new UserModel({
    username,
    password,
    email,

    nsfwPolicy: CONFIG.INSTANCE.DEFAULT_NSFW_POLICY,
    p2pEnabled: CONFIG.DEFAULTS.P2P.WEBAPP.ENABLED,
    videosHistoryEnabled: CONFIG.USER.HISTORY.VIDEOS.ENABLED,

    autoPlayVideo: CONFIG.DEFAULTS.PLAYER.AUTO_PLAY,

    role,
    emailVerified,
    adminFlags,

    videoQuota,
    videoQuotaDaily,

    pluginAuth
  })
}

// ---------------------------------------------------------------------------

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

    const channelAttributes = await buildChannelAttributes({ user: userCreated, transaction: t, channelNames })
    const videoChannel = await createLocalVideoChannelWithoutKeys(channelAttributes, accountCreated, t)

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
    applicationId,
    t: undefined,
    type: 'Application'
  })

  accountCreated.Actor = await generateAndSaveActorKeys(accountCreated.Actor)

  return accountCreated
}

// ---------------------------------------------------------------------------

async function sendVerifyUserEmail (user: MUser, isPendingEmail = false) {
  const verificationString = await Redis.Instance.setUserVerifyEmailVerificationString(user.id)
  let verifyEmailUrl = `${WEBSERVER.URL}/verify-account/email?userId=${user.id}&verificationString=${verificationString}`

  if (isPendingEmail) verifyEmailUrl += '&isPendingEmail=true'

  const to = isPendingEmail
    ? user.pendingEmail
    : user.email

  const username = user.username

  Emailer.Instance.addVerifyEmailJob({ username, to, verifyEmailUrl, isRegistrationRequest: false })
}

async function sendVerifyRegistrationEmail (registration: MRegistration) {
  const verificationString = await Redis.Instance.setRegistrationVerifyEmailVerificationString(registration.id)
  const verifyEmailUrl = `${WEBSERVER.URL}/verify-account/email?registrationId=${registration.id}&verificationString=${verificationString}`

  const to = registration.email
  const username = registration.username

  Emailer.Instance.addVerifyEmailJob({ username, to, verifyEmailUrl, isRegistrationRequest: true })
}

// ---------------------------------------------------------------------------

async function getOriginalVideoFileTotalFromUser (user: MUserId) {
  const base = await UserModel.getUserQuota({ userId: user.id, daily: false })

  return base + LiveQuotaStore.Instance.getLiveQuotaOfUser(user.id)
}

// Returns cumulative size of all video files uploaded in the last 24 hours.
async function getOriginalVideoFileTotalDailyFromUser (user: MUserId) {
  const base = await UserModel.getUserQuota({ userId: user.id, daily: true })

  return base + LiveQuotaStore.Instance.getLiveQuotaOfUser(user.id)
}

async function isUserQuotaValid (options: {
  userId: number
  uploadSize: number
  checkDaily?: boolean // default true
}) {
  const { userId, uploadSize, checkDaily = true } = options
  const user = await UserModel.loadById(userId)

  if (user.videoQuota === -1 && user.videoQuotaDaily === -1) return Promise.resolve(true)

  const [ totalBytes, totalBytesDaily ] = await Promise.all([
    getOriginalVideoFileTotalFromUser(user),
    getOriginalVideoFileTotalDailyFromUser(user)
  ])

  const uploadedTotal = uploadSize + totalBytes
  const uploadedDaily = uploadSize + totalBytesDaily

  logger.debug(
    'Check user %d quota to upload content.', userId,
    { totalBytes, totalBytesDaily, videoQuota: user.videoQuota, videoQuotaDaily: user.videoQuotaDaily, uploadSize }
  )

  if (checkDaily && user.videoQuotaDaily !== -1 && uploadedDaily >= user.videoQuotaDaily) return false
  if (user.videoQuota !== -1 && uploadedTotal >= user.videoQuota) return false

  return true
}

function getUserByEmailPermissive <T extends { email: string }> (users: T[], email: string): T {
  if (users.length === 1) return users[0]

  return users.find(r => r.email === email)
}

// ---------------------------------------------------------------------------

export {
  getOriginalVideoFileTotalFromUser,
  getOriginalVideoFileTotalDailyFromUser,
  createApplicationActor,
  createUserAccountAndChannelAndPlaylist,
  createLocalAccountWithoutKeys,

  sendVerifyUserEmail,
  sendVerifyRegistrationEmail,

  isUserQuotaValid,
  buildUser,
  getUserByEmailPermissive
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
    newPluginVersion: UserNotificationSettingValue.WEB,
    myVideoStudioEditionFinished: UserNotificationSettingValue.WEB,
    myVideoTranscriptionGenerated: UserNotificationSettingValue.WEB
  }

  return UserNotificationSettingModel.create(values, { transaction: t })
}

async function buildChannelAttributes (options: {
  user: MUser
  transaction?: Transaction
  channelNames?: ChannelNames
}) {
  const { user, transaction, channelNames } = options

  if (channelNames) return channelNames

  const channelName = await findAvailableLocalActorName(user.username + '_channel', transaction)
  const videoChannelDisplayName = CONFIG.USER.DEFAULT_CHANNEL_NAME.replace('$1', user.username)

  return {
    name: channelName,
    displayName: videoChannelDisplayName
  }
}
