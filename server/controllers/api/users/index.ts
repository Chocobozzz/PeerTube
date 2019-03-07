import * as express from 'express'
import * as RateLimit from 'express-rate-limit'
import { UserCreate, UserRight, UserRole, UserUpdate } from '../../../../shared'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects } from '../../../helpers/utils'
import { CONFIG, RATES_LIMIT, sequelizeTypescript } from '../../../initializers'
import { Emailer } from '../../../lib/emailer'
import { Redis } from '../../../lib/redis'
import { createUserAccountAndChannelAndPlaylist } from '../../../lib/user'
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
  userAutocompleteValidator,
  usersAddValidator,
  usersGetValidator,
  usersRegisterValidator,
  usersRemoveValidator,
  usersSortValidator,
  usersUpdateValidator
} from '../../../middlewares'
import {
  usersAskResetPasswordValidator,
  usersAskSendVerifyEmailValidator,
  usersBlockingValidator,
  usersResetPasswordValidator,
  usersVerifyEmailValidator
} from '../../../middlewares/validators'
import { UserModel } from '../../../models/account/user'
import { auditLoggerFactory, getAuditIdFromRes, UserAuditView } from '../../../helpers/audit-logger'
import { meRouter } from './me'
import { deleteUserToken } from '../../../lib/oauth-model'
import { myBlocklistRouter } from './my-blocklist'
import { myVideoPlaylistsRouter } from './my-video-playlists'
import { myVideosHistoryRouter } from './my-history'
import { myNotificationsRouter } from './my-notifications'
import { Notifier } from '../../../lib/notifier'
import { mySubscriptionsRouter } from './my-subscriptions'

const auditLogger = auditLoggerFactory('users')

const loginRateLimiter = new RateLimit({
  windowMs: RATES_LIMIT.LOGIN.WINDOW_MS,
  max: RATES_LIMIT.LOGIN.MAX
})

const askSendEmailLimiter = new RateLimit({
  windowMs: RATES_LIMIT.ASK_SEND_EMAIL.WINDOW_MS,
  max: RATES_LIMIT.ASK_SEND_EMAIL.MAX
})

const usersRouter = express.Router()
usersRouter.use('/', myNotificationsRouter)
usersRouter.use('/', mySubscriptionsRouter)
usersRouter.use('/', myBlocklistRouter)
usersRouter.use('/', myVideosHistoryRouter)
usersRouter.use('/', myVideoPlaylistsRouter)
usersRouter.use('/', meRouter)

usersRouter.get('/autocomplete',
  userAutocompleteValidator,
  asyncMiddleware(autocompleteUsers)
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

usersRouter.post('/ask-send-verify-email',
  askSendEmailLimiter,
  asyncMiddleware(usersAskSendVerifyEmailValidator),
  asyncMiddleware(askSendVerifyUserEmail)
)

usersRouter.post('/:id/verify-email',
  asyncMiddleware(usersVerifyEmailValidator),
  asyncMiddleware(verifyUserEmail)
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

async function createUser (req: express.Request, res: express.Response) {
  const body: UserCreate = req.body
  const userToCreate = new UserModel({
    username: body.username,
    password: body.password,
    email: body.email,
    nsfwPolicy: CONFIG.INSTANCE.DEFAULT_NSFW_POLICY,
    autoPlayVideo: true,
    role: body.role,
    videoQuota: body.videoQuota,
    videoQuotaDaily: body.videoQuotaDaily
  })

  const { user, account } = await createUserAccountAndChannelAndPlaylist(userToCreate)

  auditLogger.create(getAuditIdFromRes(res), new UserAuditView(user.toFormattedJSON()))
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
    videoQuota: CONFIG.USER.VIDEO_QUOTA,
    videoQuotaDaily: CONFIG.USER.VIDEO_QUOTA_DAILY,
    emailVerified: CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION ? false : null
  })

  const { user } = await createUserAccountAndChannelAndPlaylist(userToCreate)

  auditLogger.create(body.username, new UserAuditView(user.toFormattedJSON()))
  logger.info('User %s with its channel and account registered.', body.username)

  if (CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION) {
    await sendVerifyUserEmail(user)
  }

  Notifier.Instance.notifyOnNewUserRegistration(user)

  return res.type('json').status(204).end()
}

async function unblockUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user: UserModel = res.locals.user

  await changeUserBlock(res, user, false)

  return res.status(204).end()
}

async function blockUser (req: express.Request, res: express.Response) {
  const user: UserModel = res.locals.user
  const reason = req.body.reason

  await changeUserBlock(res, user, true, reason)

  return res.status(204).end()
}

function getUser (req: express.Request, res: express.Response) {
  return res.json((res.locals.user as UserModel).toFormattedJSON())
}

async function autocompleteUsers (req: express.Request, res: express.Response) {
  const resultList = await UserModel.autoComplete(req.query.search as string)

  return res.json(resultList)
}

async function listUsers (req: express.Request, res: express.Response) {
  const resultList = await UserModel.listForApi(req.query.start, req.query.count, req.query.sort, req.query.search)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function removeUser (req: express.Request, res: express.Response) {
  const user: UserModel = res.locals.user

  await user.destroy()

  auditLogger.delete(getAuditIdFromRes(res), new UserAuditView(user.toFormattedJSON()))

  return res.sendStatus(204)
}

async function updateUser (req: express.Request, res: express.Response) {
  const body: UserUpdate = req.body
  const userToUpdate = res.locals.user as UserModel
  const oldUserAuditView = new UserAuditView(userToUpdate.toFormattedJSON())
  const roleChanged = body.role !== undefined && body.role !== userToUpdate.role

  if (body.password !== undefined) userToUpdate.password = body.password
  if (body.email !== undefined) userToUpdate.email = body.email
  if (body.emailVerified !== undefined) userToUpdate.emailVerified = body.emailVerified
  if (body.videoQuota !== undefined) userToUpdate.videoQuota = body.videoQuota
  if (body.videoQuotaDaily !== undefined) userToUpdate.videoQuotaDaily = body.videoQuotaDaily
  if (body.role !== undefined) userToUpdate.role = body.role

  const user = await userToUpdate.save()

  // Destroy user token to refresh rights
  if (roleChanged || body.password !== undefined) await deleteUserToken(userToUpdate.id)

  auditLogger.update(getAuditIdFromRes(res), new UserAuditView(user.toFormattedJSON()), oldUserAuditView)

  // Don't need to send this update to followers, these attributes are not federated

  return res.sendStatus(204)
}

async function askResetUserPassword (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.user as UserModel

  const verificationString = await Redis.Instance.setResetPasswordVerificationString(user.id)
  const url = CONFIG.WEBSERVER.URL + '/reset-password?userId=' + user.id + '&verificationString=' + verificationString
  await Emailer.Instance.addPasswordResetEmailJob(user.email, url)

  return res.status(204).end()
}

async function resetUserPassword (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.user as UserModel
  user.password = req.body.password

  await user.save()

  return res.status(204).end()
}

async function sendVerifyUserEmail (user: UserModel) {
  const verificationString = await Redis.Instance.setVerifyEmailVerificationString(user.id)
  const url = CONFIG.WEBSERVER.URL + '/verify-account/email?userId=' + user.id + '&verificationString=' + verificationString
  await Emailer.Instance.addVerifyEmailJob(user.email, url)
  return
}

async function askSendVerifyUserEmail (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.user as UserModel

  await sendVerifyUserEmail(user)

  return res.status(204).end()
}

async function verifyUserEmail (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.user as UserModel
  user.emailVerified = true

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
    await deleteUserToken(user.id, t)

    await user.save({ transaction: t })
  })

  await Emailer.Instance.addUserBlockJob(user, block, reason)

  auditLogger.update(getAuditIdFromRes(res), new UserAuditView(user.toFormattedJSON()), oldUserAuditView)
}
