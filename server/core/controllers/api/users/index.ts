import { pick } from '@peertube/peertube-core-utils'
import { HttpStatusCode, UserCreate, UserRight, UserUpdate } from '@peertube/peertube-models'
import { tokensRouter } from '@server/controllers/api/users/token.js'
import { retryTransactionWrapper, runTransaction } from '@server/helpers/database-utils.js'
import { CONFIG } from '@server/initializers/config.js'
import { getResetPasswordUrl } from '@server/lib/client-urls.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { OAuthTokenModel } from '@server/models/oauth/oauth-token.js'
import { MUserAccountDefault } from '@server/types/models/index.js'
import express from 'express'
import { createLogger } from '../../../helpers/logger.js'
import { generateRandomString, getFormattedObjects } from '../../../helpers/utils.js'
import {
  auditLog,
  buildPasswordResetAuditEntity,
  buildUserAuditEntity,
  getAuditActorFromRes,
  getAuditActorFromUser,
  getAuditAnonymousActor
} from '../../../lib/audit-log/index.js'
import { Emailer } from '../../../lib/emailer.js'
import { Redis } from '../../../lib/redis/index.js'
import { buildUser, createUserAccountAndChannelAndPlaylist } from '../../../lib/user.js'
import {
  adminUsersSortValidator,
  apiRateLimiter,
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  buildRateLimiter,
  confirmTokenRateLimiter,
  ensureUserHasRight,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  userAutocompleteValidator,
  usersAddValidator,
  usersGetValidator,
  usersListValidator,
  usersRemoveValidator,
  usersUpdateValidator
} from '../../../middlewares/index.js'
import {
  usersAskResetPasswordValidator,
  usersBlockToggleValidator,
  usersResetPasswordValidator
} from '../../../middlewares/validators/index.js'
import { UserModel } from '../../../models/user/user.js'
import { emailVerificationRouter } from './email-verification.js'
import { meRouter } from './me.js'
import { myAbusesRouter } from './my-abuses.js'
import { myBlocklistRouter } from './my-blocklist.js'
import { myVideosHistoryRouter } from './my-history.js'
import { myNotificationsRouter } from './my-notifications.js'
import { mySubscriptionsRouter } from './my-subscriptions.js'
import { myVideoPlaylistsRouter } from './my-video-playlists.js'
import { registrationsRouter } from './registrations.js'
import { twoFactorRouter } from './two-factor.js'
import { userExportsRouter } from './user-exports.js'
import { userImportRouter } from './user-imports.js'

const logger = createLogger('api', 'users')

const askResetPasswordRateLimiter = buildRateLimiter({
  enabled: CONFIG.RATES_LIMIT.ASK_SEND_EMAIL.ENABLED,
  name: 'ask-reset-password',
  windowMs: CONFIG.RATES_LIMIT.ASK_SEND_EMAIL.WINDOW_MS,
  max: CONFIG.RATES_LIMIT.ASK_SEND_EMAIL.MAX,
  failOnUnavailableRedis: true
})

const usersRouter = express.Router()

usersRouter.use(apiRateLimiter)

usersRouter.use('/', emailVerificationRouter)
usersRouter.use('/', userExportsRouter)
usersRouter.use('/', userImportRouter)
usersRouter.use('/', registrationsRouter)
usersRouter.use('/', twoFactorRouter)
usersRouter.use('/', tokensRouter)
usersRouter.use('/', myNotificationsRouter)
usersRouter.use('/', mySubscriptionsRouter)
usersRouter.use('/', myBlocklistRouter)
usersRouter.use('/', myVideosHistoryRouter)
usersRouter.use('/', myVideoPlaylistsRouter)
usersRouter.use('/', myAbusesRouter)
usersRouter.use('/', meRouter)

usersRouter.get('/autocomplete', userAutocompleteValidator, asyncMiddleware(autocompleteUsers))

usersRouter.get(
  '/',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  paginationValidator,
  adminUsersSortValidator,
  setDefaultSort,
  setDefaultPagination,
  usersListValidator,
  asyncMiddleware(listUsers)
)

usersRouter.post(
  '/:id/block',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersBlockToggleValidator),
  asyncMiddleware(blockUser)
)
usersRouter.post(
  '/:id/unblock',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersBlockToggleValidator),
  asyncMiddleware(unblockUser)
)

usersRouter.get(
  '/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersGetValidator),
  getUser
)

usersRouter.post(
  '/',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersAddValidator),
  asyncRetryTransactionMiddleware(createUser)
)

usersRouter.put(
  '/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersUpdateValidator),
  asyncMiddleware(updateUser)
)

usersRouter.delete(
  '/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersRemoveValidator),
  asyncMiddleware(removeUser)
)

usersRouter.post(
  '/ask-reset-password',
  askResetPasswordRateLimiter,
  asyncMiddleware(usersAskResetPasswordValidator),
  asyncMiddleware(askResetUserPassword)
)

usersRouter.post(
  '/:id/reset-password',
  confirmTokenRateLimiter,
  asyncMiddleware(usersResetPasswordValidator),
  asyncMiddleware(resetUserPassword)
)

// ---------------------------------------------------------------------------

export {
  usersRouter
}

// ---------------------------------------------------------------------------

async function createUser (req: express.Request, res: express.Response) {
  const body: UserCreate = req.body

  return logger.withContext([ body.username ], async () => {
    const userToCreate = buildUser({
      ...pick(body, [ 'username', 'password', 'email', 'role', 'videoQuota', 'videoQuotaDaily', 'adminFlags' ]),

      emailVerified: null
    })

    // NB: due to the validator usersAddValidator, password==='' can only be true if we can send the mail.
    const createPassword = userToCreate.password === ''
    if (createPassword) {
      userToCreate.password = await generateRandomString(20)
    }

    const { user, account, videoChannel } = await createUserAccountAndChannelAndPlaylist({
      userToCreate,
      channelNames: body.channelName && { name: body.channelName, displayName: body.channelName }
    })

    auditLog.create(getAuditActorFromRes(res), () => buildUserAuditEntity(user))
    logger.info('User %s with its channel and account created.', body.username)

    if (createPassword) {
      // This will send an email for newly created users, so then can set their first password
      logger.info('Sending to user %s a create password email', body.username)

      const verificationString = await Redis.Instance.setCreatePasswordVerificationString(user.id)

      Emailer.Instance.addPasswordCreateEmailJob({
        username: userToCreate.username,
        to: user.email,
        language: user.getLanguage(),
        createPasswordUrl: getResetPasswordUrl(user, verificationString)
      })
    }

    Hooks.runAction('action:api.user.created', { body, user, account, videoChannel, req, res })

    return res.json({
      user: {
        id: user.id,
        account: {
          id: account.id
        }
      }
    })
  })
}

async function unblockUser (req: express.Request, res: express.Response) {
  const user = res.locals.user
  const byUser = res.locals.oauth.token.User

  return logger.withContext([ user.username, byUser.username ], async () => {
    await changeUserBlock(res, user, false)

    logger.info(`Unblocked user ${user.username} by moderator ${byUser.username}.`)

    Hooks.runAction('action:api.user.unblocked', { user, req, res })

    return res.status(HttpStatusCode.NO_CONTENT_204).end()
  })
}

async function blockUser (req: express.Request, res: express.Response) {
  const user = res.locals.user
  const byUser = res.locals.oauth.token.User
  const reason = req.body.reason

  return logger.withContext([ user.username, byUser.username ], async () => {
    await changeUserBlock(res, user, true, reason)

    logger.info(`Blocked user ${user.username} by moderator ${byUser.username}.`)

    Hooks.runAction('action:api.user.blocked', { user, req, res })

    return res.status(HttpStatusCode.NO_CONTENT_204).end()
  })
}

function getUser (req: express.Request, res: express.Response) {
  return res.json(res.locals.user.toFormattedJSON({ withAdminFlags: true }))
}

async function autocompleteUsers (req: express.Request, res: express.Response) {
  const resultList = await UserModel.autoComplete(req.query.search as string)

  return res.json(resultList)
}

async function listUsers (req: express.Request, res: express.Response) {
  const resultList = await UserModel.listForAdminApi({
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    search: req.query.search,
    blocked: req.query.blocked,
    role: req.query.role
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total, { withAdminFlags: true }))
}

async function removeUser (req: express.Request, res: express.Response) {
  const user = res.locals.user
  const byUser = res.locals.oauth.token.User

  return logger.withContext([ user.username, byUser.username ], async () => {
    auditLog.delete(getAuditActorFromRes(res), () => buildUserAuditEntity(user))

    await retryTransactionWrapper(() => {
      return runTransaction(t => {
        // Use a transaction to avoid inconsistencies with hooks (account/channel deletion & federation)
        return user.destroy({ transaction: t })
      })
    })

    logger.info(`Removed user ${user.username} by moderator ${byUser.username}.`)

    Hooks.runAction('action:api.user.deleted', { user, req, res })

    return res.status(HttpStatusCode.NO_CONTENT_204).end()
  })
}

async function updateUser (req: express.Request, res: express.Response) {
  const userToUpdate = res.locals.user
  const byUser = res.locals.oauth.token.User

  return logger.withContext([ userToUpdate.username, byUser.username ], async () => {
    const body: UserUpdate = req.body
    const oldUserAuditEntity = auditLog.snapshot(() => buildUserAuditEntity(userToUpdate))
    const roleChanged = body.role !== undefined && body.role !== userToUpdate.role

    const keysToUpdate: (keyof UserUpdate)[] = [
      'password',
      'email',
      'emailVerified',
      'videoQuota',
      'videoQuotaDaily',
      'role',
      'adminFlags',
      'pluginAuth'
    ]

    for (const key of keysToUpdate) {
      if (body[key] !== undefined) userToUpdate.set(key, body[key])
    }

    const user = await userToUpdate.save()

    // Destroy user token to refresh rights
    if (roleChanged || body.password !== undefined) {
      await OAuthTokenModel.deleteUserToken({ userId: userToUpdate.id })
    }

    auditLog.update(getAuditActorFromRes(res), () => buildUserAuditEntity(user), oldUserAuditEntity, {
      secretChanges: body.password !== undefined
        ? [ 'password' ]
        : []
    })

    logger.info(`Updated user ${user.username} by moderator ${byUser.username}.`)

    Hooks.runAction('action:api.user.updated', { user, req, res })

    // Don't need to send this update to followers, these attributes are not federated

    return res.status(HttpStatusCode.NO_CONTENT_204).end()
  })
}

async function askResetUserPassword (req: express.Request, res: express.Response) {
  const user = res.locals.user

  return logger.withContext([ user.username ], async () => {
    const verificationString = await Redis.Instance.setResetPasswordVerificationString(user.id)
    Emailer.Instance.addPasswordResetEmailJob({
      username: user.username,
      to: user.email,
      language: user.getLanguage(),
      resetPasswordUrl: getResetPasswordUrl(user, verificationString)
    })

    auditLog.create(getAuditAnonymousActor(req), () => buildPasswordResetAuditEntity(user))

    logger.info(`User ${user.username} asked password reset.`)

    return res.status(HttpStatusCode.NO_CONTENT_204).end()
  })
}

async function resetUserPassword (req: express.Request, res: express.Response) {
  const user = res.locals.user

  return logger.withContext([ user.username ], async () => {
    const oldUserAuditEntity = auditLog.snapshot(() => buildUserAuditEntity(user))

    user.password = req.body.password

    await user.save()

    // The user is not authenticated, but proved they own the account with the reset link
    auditLog.update(getAuditActorFromUser(user, req), () => buildUserAuditEntity(user), oldUserAuditEntity, {
      secretChanges: [ 'password' ]
    })

    await Redis.Instance.removePasswordVerificationString(user.id)
    await OAuthTokenModel.deleteUserToken({ userId: user.id })

    logger.info(`User ${user.username} reset its password.`)

    return res.status(HttpStatusCode.NO_CONTENT_204).end()
  })
}

async function changeUserBlock (res: express.Response, user: MUserAccountDefault, block: boolean, reason?: string) {
  const oldUserAuditEntity = auditLog.snapshot(() => buildUserAuditEntity(user))

  user.blocked = block
  user.blockedReason = reason || null

  await runTransaction(async transaction => {
    await OAuthTokenModel.deleteUserToken({ userId: user.id, transaction })

    await user.save({ transaction })
  })

  Emailer.Instance.addUserBlockJob({ username: user.username, email: user.email, language: user.getLanguage(), blocked: block, reason })

  auditLog.update(getAuditActorFromRes(res), () => buildUserAuditEntity(user), oldUserAuditEntity)
}
