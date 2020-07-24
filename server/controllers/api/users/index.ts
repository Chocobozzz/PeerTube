import * as express from 'express'
import * as RateLimit from 'express-rate-limit'
import { tokensRouter } from '@server/controllers/api/users/token'
import { Hooks } from '@server/lib/plugins/hooks'
import { MUser, MUserAccountDefault } from '@server/types/models'
import { UserCreate, UserRight, UserRole, UserUpdate } from '../../../../shared'
import { UserAdminFlag } from '../../../../shared/models/users/user-flag.model'
import { UserRegister } from '../../../../shared/models/users/user-register.model'
import { auditLoggerFactory, getAuditIdFromRes, UserAuditView } from '../../../helpers/audit-logger'
import { logger } from '../../../helpers/logger'
import { generateRandomString, getFormattedObjects } from '../../../helpers/utils'
import { CONFIG } from '../../../initializers/config'
import { WEBSERVER } from '../../../initializers/constants'
import { sequelizeTypescript } from '../../../initializers/database'
import { Emailer } from '../../../lib/emailer'
import { Notifier } from '../../../lib/notifier'
import { deleteUserToken } from '../../../lib/oauth-model'
import { Redis } from '../../../lib/redis'
import { createUserAccountAndChannelAndPlaylist, sendVerifyUserEmail } from '../../../lib/user'
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
  userAutocompleteValidator,
  usersAddValidator,
  usersGetValidator,
  usersListValidator,
  usersRegisterValidator,
  usersRemoveValidator,
  usersSortValidator,
  usersUpdateValidator
} from '../../../middlewares'
import {
  ensureCanManageUser,
  usersAskResetPasswordValidator,
  usersAskSendVerifyEmailValidator,
  usersBlockingValidator,
  usersResetPasswordValidator,
  usersVerifyEmailValidator
} from '../../../middlewares/validators'
import { UserModel } from '../../../models/account/user'
import { meRouter } from './me'
import { myAbusesRouter } from './my-abuses'
import { myBlocklistRouter } from './my-blocklist'
import { myVideosHistoryRouter } from './my-history'
import { myNotificationsRouter } from './my-notifications'
import { mySubscriptionsRouter } from './my-subscriptions'
import { myVideoPlaylistsRouter } from './my-video-playlists'

const auditLogger = auditLoggerFactory('users')

const signupRateLimiter = RateLimit({
  windowMs: CONFIG.RATES_LIMIT.SIGNUP.WINDOW_MS,
  max: CONFIG.RATES_LIMIT.SIGNUP.MAX,
  skipFailedRequests: true
})

const askSendEmailLimiter = RateLimit({
  windowMs: CONFIG.RATES_LIMIT.ASK_SEND_EMAIL.WINDOW_MS,
  max: CONFIG.RATES_LIMIT.ASK_SEND_EMAIL.MAX
})

const usersRouter = express.Router()
usersRouter.use('/', tokensRouter)
usersRouter.use('/', myNotificationsRouter)
usersRouter.use('/', mySubscriptionsRouter)
usersRouter.use('/', myBlocklistRouter)
usersRouter.use('/', myVideosHistoryRouter)
usersRouter.use('/', myVideoPlaylistsRouter)
usersRouter.use('/', myAbusesRouter)
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
  usersListValidator,
  asyncMiddleware(listUsers)
)

usersRouter.post('/:id/block',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersBlockingValidator),
  ensureCanManageUser,
  asyncMiddleware(blockUser)
)
usersRouter.post('/:id/unblock',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersBlockingValidator),
  ensureCanManageUser,
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
  signupRateLimiter,
  asyncMiddleware(ensureUserRegistrationAllowed),
  ensureUserRegistrationAllowedForIP,
  asyncMiddleware(usersRegisterValidator),
  asyncRetryTransactionMiddleware(registerUser)
)

usersRouter.put('/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersUpdateValidator),
  ensureCanManageUser,
  asyncMiddleware(updateUser)
)

usersRouter.delete('/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersRemoveValidator),
  ensureCanManageUser,
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
  asyncMiddleware(reSendVerifyUserEmail)
)

usersRouter.post('/:id/verify-email',
  asyncMiddleware(usersVerifyEmailValidator),
  asyncMiddleware(verifyUserEmail)
)

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
    videoQuotaDaily: body.videoQuotaDaily,
    adminFlags: body.adminFlags || UserAdminFlag.NONE
  }) as MUser

  // NB: due to the validator usersAddValidator, password==='' can only be true if we can send the mail.
  const createPassword = userToCreate.password === ''
  if (createPassword) {
    userToCreate.password = await generateRandomString(20)
  }

  const { user, account, videoChannel } = await createUserAccountAndChannelAndPlaylist({ userToCreate: userToCreate })

  auditLogger.create(getAuditIdFromRes(res), new UserAuditView(user.toFormattedJSON()))
  logger.info('User %s with its channel and account created.', body.username)

  if (createPassword) {
    // this will send an email for newly created users, so then can set their first password.
    logger.info('Sending to user %s a create password email', body.username)
    const verificationString = await Redis.Instance.setCreatePasswordVerificationString(user.id)
    const url = WEBSERVER.URL + '/reset-password?userId=' + user.id + '&verificationString=' + verificationString
    await Emailer.Instance.addPasswordCreateEmailJob(userToCreate.username, user.email, url)
  }

  Hooks.runAction('action:api.user.created', { body, user, account, videoChannel })

  return res.json({
    user: {
      id: user.id,
      account: {
        id: account.id
      }
    }
  }).end()
}

async function registerUser (req: express.Request, res: express.Response) {
  const body: UserRegister = req.body

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

  const { user, account, videoChannel } = await createUserAccountAndChannelAndPlaylist({
    userToCreate: userToCreate,
    userDisplayName: body.displayName || undefined,
    channelNames: body.channel
  })

  auditLogger.create(body.username, new UserAuditView(user.toFormattedJSON()))
  logger.info('User %s with its channel and account registered.', body.username)

  if (CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION) {
    await sendVerifyUserEmail(user)
  }

  Notifier.Instance.notifyOnNewUserRegistration(user)

  Hooks.runAction('action:api.user.registered', { body, user, account, videoChannel })

  return res.type('json').status(204).end()
}

async function unblockUser (req: express.Request, res: express.Response) {
  const user = res.locals.user

  await changeUserBlock(res, user, false)

  Hooks.runAction('action:api.user.unblocked', { user })

  return res.status(204).end()
}

async function blockUser (req: express.Request, res: express.Response) {
  const user = res.locals.user
  const reason = req.body.reason

  await changeUserBlock(res, user, true, reason)

  Hooks.runAction('action:api.user.blocked', { user })

  return res.status(204).end()
}

function getUser (req: express.Request, res: express.Response) {
  return res.json(res.locals.user.toFormattedJSON({ withAdminFlags: true }))
}

async function autocompleteUsers (req: express.Request, res: express.Response) {
  const resultList = await UserModel.autoComplete(req.query.search as string)

  return res.json(resultList)
}

async function listUsers (req: express.Request, res: express.Response) {
  const resultList = await UserModel.listForApi({
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    search: req.query.search,
    blocked: req.query.blocked
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total, { withAdminFlags: true }))
}

async function removeUser (req: express.Request, res: express.Response) {
  const user = res.locals.user

  await user.destroy()

  auditLogger.delete(getAuditIdFromRes(res), new UserAuditView(user.toFormattedJSON()))

  Hooks.runAction('action:api.user.deleted', { user })

  return res.sendStatus(204)
}

async function updateUser (req: express.Request, res: express.Response) {
  const body: UserUpdate = req.body
  const userToUpdate = res.locals.user
  const oldUserAuditView = new UserAuditView(userToUpdate.toFormattedJSON())
  const roleChanged = body.role !== undefined && body.role !== userToUpdate.role

  if (body.password !== undefined) userToUpdate.password = body.password
  if (body.email !== undefined) userToUpdate.email = body.email
  if (body.emailVerified !== undefined) userToUpdate.emailVerified = body.emailVerified
  if (body.videoQuota !== undefined) userToUpdate.videoQuota = body.videoQuota
  if (body.videoQuotaDaily !== undefined) userToUpdate.videoQuotaDaily = body.videoQuotaDaily
  if (body.role !== undefined) userToUpdate.role = body.role
  if (body.adminFlags !== undefined) userToUpdate.adminFlags = body.adminFlags

  const user = await userToUpdate.save()

  // Destroy user token to refresh rights
  if (roleChanged || body.password !== undefined) await deleteUserToken(userToUpdate.id)

  auditLogger.update(getAuditIdFromRes(res), new UserAuditView(user.toFormattedJSON()), oldUserAuditView)

  Hooks.runAction('action:api.user.updated', { user })

  // Don't need to send this update to followers, these attributes are not federated

  return res.sendStatus(204)
}

async function askResetUserPassword (req: express.Request, res: express.Response) {
  const user = res.locals.user

  const verificationString = await Redis.Instance.setResetPasswordVerificationString(user.id)
  const url = WEBSERVER.URL + '/reset-password?userId=' + user.id + '&verificationString=' + verificationString
  await Emailer.Instance.addPasswordResetEmailJob(user.username, user.email, url)

  return res.status(204).end()
}

async function resetUserPassword (req: express.Request, res: express.Response) {
  const user = res.locals.user
  user.password = req.body.password

  await user.save()

  return res.status(204).end()
}

async function reSendVerifyUserEmail (req: express.Request, res: express.Response) {
  const user = res.locals.user

  await sendVerifyUserEmail(user)

  return res.status(204).end()
}

async function verifyUserEmail (req: express.Request, res: express.Response) {
  const user = res.locals.user
  user.emailVerified = true

  if (req.body.isPendingEmail === true) {
    user.email = user.pendingEmail
    user.pendingEmail = null
  }

  await user.save()

  return res.status(204).end()
}

async function changeUserBlock (res: express.Response, user: MUserAccountDefault, block: boolean, reason?: string) {
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
