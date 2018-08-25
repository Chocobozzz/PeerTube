import * as express from 'express'
import 'multer'
import * as RateLimit from 'express-rate-limit'
import { UserCreate, UserRight, UserRole, UserUpdate, UserUpdateMe, UserVideoRate as FormattedUserVideoRate } from '../../../shared'
import { logger } from '../../helpers/logger'
import { getFormattedObjects } from '../../helpers/utils'
import { CONFIG, IMAGE_MIMETYPE_EXT, RATES_LIMIT, sequelizeTypescript } from '../../initializers'
import { sendUpdateActor } from '../../lib/activitypub/send'
import { Emailer } from '../../lib/emailer'
import { Redis } from '../../lib/redis'
import { createUserAccountAndChannel } from '../../lib/user'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  ensureUserHasRight,
  ensureUserRegistrationAllowed,
  ensureUserRegistrationAllowedForIP,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  token,
  usersAddValidator,
  usersGetValidator,
  usersRegisterValidator,
  usersRemoveValidator,
  usersSortValidator,
  usersUpdateMeValidator,
  usersUpdateValidator,
  usersVideoRatingValidator
} from '../../middlewares'
import {
  deleteMeValidator,
  usersAskResetPasswordValidator,
  usersBlockingValidator,
  usersResetPasswordValidator,
  videoImportsSortValidator,
  videosSortValidator
} from '../../middlewares/validators'
import { AccountVideoRateModel } from '../../models/account/account-video-rate'
import { UserModel } from '../../models/account/user'
import { OAuthTokenModel } from '../../models/oauth/oauth-token'
import { VideoModel } from '../../models/video/video'
import { VideoSortField } from '../../../client/src/app/shared/video/sort-field.type'
import { createReqFiles } from '../../helpers/express-utils'
import { UserVideoQuota } from '../../../shared/models/users/user-video-quota.model'
import { updateAvatarValidator } from '../../middlewares/validators/avatar'
import { updateActorAvatarFile } from '../../lib/avatar'
import { auditLoggerFactory, UserAuditView } from '../../helpers/audit-logger'
import { VideoImportModel } from '../../models/video/video-import'

const auditLogger = auditLoggerFactory('users')

const reqAvatarFile = createReqFiles([ 'avatarfile' ], IMAGE_MIMETYPE_EXT, { avatarfile: CONFIG.STORAGE.AVATARS_DIR })
const loginRateLimiter = new RateLimit({
  windowMs: RATES_LIMIT.LOGIN.WINDOW_MS,
  max: RATES_LIMIT.LOGIN.MAX,
  delayMs: 0
})

const usersRouter = express.Router()

usersRouter.get('/me',
  authenticate,
  asyncMiddleware(getUserInformation)
)
usersRouter.delete('/me',
  authenticate,
  asyncMiddleware(deleteMeValidator),
  asyncMiddleware(deleteMe)
)

usersRouter.get('/me/video-quota-used',
  authenticate,
  asyncMiddleware(getUserVideoQuotaUsed)
)

usersRouter.get('/me/videos/imports',
  authenticate,
  paginationValidator,
  videoImportsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(getUserVideoImports)
)

usersRouter.get('/me/videos',
  authenticate,
  paginationValidator,
  videosSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(getUserVideos)
)

usersRouter.get('/me/videos/:videoId/rating',
  authenticate,
  asyncMiddleware(usersVideoRatingValidator),
  asyncMiddleware(getUserVideoRating)
)

usersRouter.get('/',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  paginationValidator,
  usersSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listUsers)
)

usersRouter.post('/:id/block',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersBlockingValidator),
  asyncMiddleware(blockUser)
)
usersRouter.post('/:id/unblock',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersBlockingValidator),
  asyncMiddleware(unblockUser)
)

usersRouter.get('/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersGetValidator),
  getUser
)

usersRouter.post('/',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersAddValidator),
  asyncRetryTransactionMiddleware(createUser)
)

usersRouter.post('/register',
  asyncMiddleware(ensureUserRegistrationAllowed),
  ensureUserRegistrationAllowedForIP,
  asyncMiddleware(usersRegisterValidator),
  asyncRetryTransactionMiddleware(registerUser)
)

usersRouter.put('/me',
  authenticate,
  usersUpdateMeValidator,
  asyncMiddleware(updateMe)
)

usersRouter.post('/me/avatar/pick',
  authenticate,
  reqAvatarFile,
  updateAvatarValidator,
  asyncMiddleware(updateMyAvatar)
)

usersRouter.put('/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersUpdateValidator),
  asyncMiddleware(updateUser)
)

usersRouter.delete('/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersRemoveValidator),
  asyncMiddleware(removeUser)
)

usersRouter.post('/ask-reset-password',
  asyncMiddleware(usersAskResetPasswordValidator),
  asyncMiddleware(askResetUserPassword)
)

usersRouter.post('/:id/reset-password',
  asyncMiddleware(usersResetPasswordValidator),
  asyncMiddleware(resetUserPassword)
)

usersRouter.post('/token',
  loginRateLimiter,
  token,
  success
)
// TODO: Once https://github.com/oauthjs/node-oauth2-server/pull/289 is merged, implement revoke token route

// ---------------------------------------------------------------------------

export {
  usersRouter
}

// ---------------------------------------------------------------------------

async function getUserVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.oauth.token.User as UserModel
  const resultList = await VideoModel.listUserVideosForApi(
    user.Account.id,
    req.query.start as number,
    req.query.count as number,
    req.query.sort as VideoSortField
  )

  const additionalAttributes = {
    waitTranscoding: true,
    state: true,
    scheduledUpdate: true,
    blacklistInfo: true
  }
  return res.json(getFormattedObjects(resultList.data, resultList.total, { additionalAttributes }))
}

async function getUserVideoImports (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.oauth.token.User as UserModel
  const resultList = await VideoImportModel.listUserVideoImportsForApi(
    user.id,
    req.query.start as number,
    req.query.count as number,
    req.query.sort
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function createUser (req: express.Request, res: express.Response) {
  const body: UserCreate = req.body
  const userToCreate = new UserModel({
    username: body.username,
    password: body.password,
    email: body.email,
    nsfwPolicy: CONFIG.INSTANCE.DEFAULT_NSFW_POLICY,
    autoPlayVideo: true,
    role: body.role,
    videoQuota: body.videoQuota
  })

  const { user, account } = await createUserAccountAndChannel(userToCreate)

  auditLogger.create(res.locals.oauth.token.User.Account.Actor.getIdentifier(), new UserAuditView(user.toFormattedJSON()))
  logger.info('User %s with its channel and account created.', body.username)

  return res.json({
    user: {
      id: user.id,
      account: {
        id: account.id,
        uuid: account.Actor.uuid
      }
    }
  }).end()
}

async function registerUser (req: express.Request, res: express.Response) {
  const body: UserCreate = req.body

  const userToCreate = new UserModel({
    username: body.username,
    password: body.password,
    email: body.email,
    nsfwPolicy: CONFIG.INSTANCE.DEFAULT_NSFW_POLICY,
    autoPlayVideo: true,
    role: UserRole.USER,
    videoQuota: CONFIG.USER.VIDEO_QUOTA
  })

  const { user } = await createUserAccountAndChannel(userToCreate)

  auditLogger.create(body.username, new UserAuditView(user.toFormattedJSON()))
  logger.info('User %s with its channel and account registered.', body.username)

  return res.type('json').status(204).end()
}

async function getUserInformation (req: express.Request, res: express.Response, next: express.NextFunction) {
  // We did not load channels in res.locals.user
  const user = await UserModel.loadByUsernameAndPopulateChannels(res.locals.oauth.token.user.username)

  return res.json(user.toFormattedJSON())
}

async function getUserVideoQuotaUsed (req: express.Request, res: express.Response, next: express.NextFunction) {
  // We did not load channels in res.locals.user
  const user = await UserModel.loadByUsernameAndPopulateChannels(res.locals.oauth.token.user.username)
  const videoQuotaUsed = await UserModel.getOriginalVideoFileTotalFromUser(user)

  const data: UserVideoQuota = {
    videoQuotaUsed
  }
  return res.json(data)
}

async function unblockUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user: UserModel = res.locals.user

  await changeUserBlock(res, user, false)

  return res.status(204).end()
}

async function blockUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user: UserModel = res.locals.user
  const reason = req.body.reason

  await changeUserBlock(res, user, true, reason)

  return res.status(204).end()
}

function getUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  return res.json((res.locals.user as UserModel).toFormattedJSON())
}

async function getUserVideoRating (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoId = +req.params.videoId
  const accountId = +res.locals.oauth.token.User.Account.id

  const ratingObj = await AccountVideoRateModel.load(accountId, videoId, null)
  const rating = ratingObj ? ratingObj.type : 'none'

  const json: FormattedUserVideoRate = {
    videoId,
    rating
  }
  res.json(json)
}

async function listUsers (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await UserModel.listForApi(req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function deleteMe (req: express.Request, res: express.Response) {
  const user: UserModel = res.locals.oauth.token.User

  await user.destroy()

  auditLogger.delete(res.locals.oauth.token.User.Account.Actor.getIdentifier(), new UserAuditView(user.toFormattedJSON()))

  return res.sendStatus(204)
}

async function removeUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user: UserModel = res.locals.user

  await user.destroy()

  auditLogger.delete(res.locals.oauth.token.User.Account.Actor.getIdentifier(), new UserAuditView(user.toFormattedJSON()))

  return res.sendStatus(204)
}

async function updateMe (req: express.Request, res: express.Response, next: express.NextFunction) {
  const body: UserUpdateMe = req.body

  const user: UserModel = res.locals.oauth.token.user
  const oldUserAuditView = new UserAuditView(user.toFormattedJSON())

  if (body.password !== undefined) user.password = body.password
  if (body.email !== undefined) user.email = body.email
  if (body.nsfwPolicy !== undefined) user.nsfwPolicy = body.nsfwPolicy
  if (body.autoPlayVideo !== undefined) user.autoPlayVideo = body.autoPlayVideo

  await sequelizeTypescript.transaction(async t => {
    await user.save({ transaction: t })

    if (body.displayName !== undefined) user.Account.name = body.displayName
    if (body.description !== undefined) user.Account.description = body.description
    await user.Account.save({ transaction: t })

    await sendUpdateActor(user.Account, t)

    auditLogger.update(
      res.locals.oauth.token.User.Account.Actor.getIdentifier(),
      new UserAuditView(user.toFormattedJSON()),
      oldUserAuditView
    )
  })

  return res.sendStatus(204)
}

async function updateMyAvatar (req: express.Request, res: express.Response, next: express.NextFunction) {
  const avatarPhysicalFile = req.files[ 'avatarfile' ][ 0 ]
  const user: UserModel = res.locals.oauth.token.user
  const oldUserAuditView = new UserAuditView(user.toFormattedJSON())
  const account = user.Account

  const avatar = await updateActorAvatarFile(avatarPhysicalFile, account.Actor, account)

  auditLogger.update(
    res.locals.oauth.token.User.Account.Actor.getIdentifier(),
    new UserAuditView(user.toFormattedJSON()),
    oldUserAuditView
  )

  return res
    .json({
      avatar: avatar.toFormattedJSON()
    })
    .end()
}

async function updateUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  const body: UserUpdate = req.body
  const userToUpdate = res.locals.user as UserModel
  const oldUserAuditView = new UserAuditView(userToUpdate.toFormattedJSON())
  const roleChanged = body.role !== undefined && body.role !== userToUpdate.role

  if (body.email !== undefined) userToUpdate.email = body.email
  if (body.videoQuota !== undefined) userToUpdate.videoQuota = body.videoQuota
  if (body.role !== undefined) userToUpdate.role = body.role

  const user = await userToUpdate.save()

  // Destroy user token to refresh rights
  if (roleChanged) {
    await OAuthTokenModel.deleteUserToken(userToUpdate.id)
  }

  auditLogger.update(
    res.locals.oauth.token.User.Account.Actor.getIdentifier(),
    new UserAuditView(user.toFormattedJSON()),
    oldUserAuditView
  )

  // Don't need to send this update to followers, these attributes are not propagated

  return res.sendStatus(204)
}

async function askResetUserPassword (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.user as UserModel

  const verificationString = await Redis.Instance.setResetPasswordVerificationString(user.id)
  const url = CONFIG.WEBSERVER.URL + '/reset-password?userId=' + user.id + '&verificationString=' + verificationString
  await Emailer.Instance.addForgetPasswordEmailJob(user.email, url)

  return res.status(204).end()
}

async function resetUserPassword (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.user as UserModel
  user.password = req.body.password

  await user.save()

  return res.status(204).end()
}

function success (req: express.Request, res: express.Response, next: express.NextFunction) {
  res.end()
}

async function changeUserBlock (res: express.Response, user: UserModel, block: boolean, reason?: string) {
  const oldUserAuditView = new UserAuditView(user.toFormattedJSON())

  user.blocked = block
  user.blockedReason = reason || null

  await sequelizeTypescript.transaction(async t => {
    await OAuthTokenModel.deleteUserToken(user.id, t)

    await user.save({ transaction: t })
  })

  await Emailer.Instance.addUserBlockJob(user, block, reason)

  auditLogger.update(
    res.locals.oauth.token.User.Account.Actor.getIdentifier(),
    new UserAuditView(user.toFormattedJSON()),
    oldUserAuditView
  )
}
