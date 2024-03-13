import express from 'express'
import { Emailer } from '@server/lib/emailer.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { UserRegistrationModel } from '@server/models/user/user-registration.js'
import { pick } from '@peertube/peertube-core-utils'
import {
  HttpStatusCode,
  UserRegister,
  UserRegistrationRequest,
  UserRegistrationState,
  UserRegistrationUpdateState,
  UserRight
} from '@peertube/peertube-models'
import { auditLoggerFactory, UserAuditView } from '../../../helpers/audit-logger.js'
import { logger } from '../../../helpers/logger.js'
import { CONFIG } from '../../../initializers/config.js'
import { Notifier } from '../../../lib/notifier/index.js'
import { buildUser, createUserAccountAndChannelAndPlaylist, sendVerifyRegistrationEmail, sendVerifyUserEmail } from '../../../lib/user.js'
import {
  acceptOrRejectRegistrationValidator,
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  buildRateLimiter,
  ensureUserHasRight,
  ensureUserRegistrationAllowedFactory,
  ensureUserRegistrationAllowedForIP,
  getRegistrationValidator,
  listRegistrationsValidator,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  userRegistrationsSortValidator,
  usersDirectRegistrationValidator,
  usersRequestRegistrationValidator
} from '../../../middlewares/index.js'

const auditLogger = auditLoggerFactory('users')

const registrationRateLimiter = buildRateLimiter({
  windowMs: CONFIG.RATES_LIMIT.SIGNUP.WINDOW_MS,
  max: CONFIG.RATES_LIMIT.SIGNUP.MAX,
  skipFailedRequests: true
})

const registrationsRouter = express.Router()

registrationsRouter.post('/registrations/request',
  registrationRateLimiter,
  asyncMiddleware(ensureUserRegistrationAllowedFactory('request-registration')),
  ensureUserRegistrationAllowedForIP,
  asyncMiddleware(usersRequestRegistrationValidator),
  asyncRetryTransactionMiddleware(requestRegistration)
)

registrationsRouter.post('/registrations/:registrationId/accept',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_REGISTRATIONS),
  asyncMiddleware(acceptOrRejectRegistrationValidator),
  asyncRetryTransactionMiddleware(acceptRegistration)
)
registrationsRouter.post('/registrations/:registrationId/reject',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_REGISTRATIONS),
  asyncMiddleware(acceptOrRejectRegistrationValidator),
  asyncRetryTransactionMiddleware(rejectRegistration)
)

registrationsRouter.delete('/registrations/:registrationId',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_REGISTRATIONS),
  asyncMiddleware(getRegistrationValidator),
  asyncRetryTransactionMiddleware(deleteRegistration)
)

registrationsRouter.get('/registrations',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_REGISTRATIONS),
  paginationValidator,
  userRegistrationsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  listRegistrationsValidator,
  asyncMiddleware(listRegistrations)
)

registrationsRouter.post('/register',
  registrationRateLimiter,
  asyncMiddleware(ensureUserRegistrationAllowedFactory('direct-registration')),
  ensureUserRegistrationAllowedForIP,
  asyncMiddleware(usersDirectRegistrationValidator),
  asyncRetryTransactionMiddleware(registerUser)
)

// ---------------------------------------------------------------------------

export {
  registrationsRouter
}

// ---------------------------------------------------------------------------

async function requestRegistration (req: express.Request, res: express.Response) {
  const body: UserRegistrationRequest = req.body

  const registration = new UserRegistrationModel({
    ...pick(body, [ 'username', 'password', 'email', 'registrationReason' ]),

    accountDisplayName: body.displayName,
    channelDisplayName: body.channel?.displayName,
    channelHandle: body.channel?.name,

    state: UserRegistrationState.PENDING,

    emailVerified: CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION ? false : null
  })

  await registration.save()

  if (CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION) {
    await sendVerifyRegistrationEmail(registration)
  }

  Notifier.Instance.notifyOnNewRegistrationRequest(registration)

  Hooks.runAction('action:api.user.requested-registration', { body, registration, req, res })

  return res.json(registration.toFormattedJSON())
}

// ---------------------------------------------------------------------------

async function acceptRegistration (req: express.Request, res: express.Response) {
  const registration = res.locals.userRegistration
  const body: UserRegistrationUpdateState = req.body

  const userToCreate = buildUser({
    username: registration.username,
    password: registration.password,
    email: registration.email,
    emailVerified: registration.emailVerified
  })
  // We already encrypted password in registration model
  userToCreate.skipPasswordEncryption = true

  // TODO: handle conflicts if someone else created a channel handle/user handle/user email between registration and approval

  const { user } = await createUserAccountAndChannelAndPlaylist({
    userToCreate,
    userDisplayName: registration.accountDisplayName,
    channelNames: registration.channelHandle && registration.channelDisplayName
      ? {
        name: registration.channelHandle,
        displayName: registration.channelDisplayName
      }
      : undefined
  })

  registration.userId = user.id
  registration.state = UserRegistrationState.ACCEPTED
  registration.moderationResponse = body.moderationResponse

  if (!registration.processedAt) registration.processedAt = new Date()

  await registration.save()

  logger.info('Registration of %s accepted', registration.username)

  if (body.preventEmailDelivery !== true) {
    Emailer.Instance.addUserRegistrationRequestProcessedJob(registration)
  }

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function rejectRegistration (req: express.Request, res: express.Response) {
  const registration = res.locals.userRegistration
  const body: UserRegistrationUpdateState = req.body

  registration.state = UserRegistrationState.REJECTED
  registration.moderationResponse = body.moderationResponse

  if (!registration.processedAt) registration.processedAt = new Date()

  await registration.save()

  if (body.preventEmailDelivery !== true) {
    Emailer.Instance.addUserRegistrationRequestProcessedJob(registration)
  }

  logger.info('Registration of %s rejected', registration.username)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

// ---------------------------------------------------------------------------

async function deleteRegistration (req: express.Request, res: express.Response) {
  const registration = res.locals.userRegistration

  await registration.destroy()

  logger.info('Registration of %s deleted', registration.username)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

// ---------------------------------------------------------------------------

async function listRegistrations (req: express.Request, res: express.Response) {
  const resultList = await UserRegistrationModel.listForApi({
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    search: req.query.search
  })

  return res.json({
    total: resultList.total,
    data: resultList.data.map(d => d.toFormattedJSON())
  })
}

// ---------------------------------------------------------------------------

async function registerUser (req: express.Request, res: express.Response) {
  const body: UserRegister = req.body

  const userToCreate = buildUser({
    ...pick(body, [ 'username', 'password', 'email' ]),

    emailVerified: CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION ? false : null
  })

  const { user, account, videoChannel } = await createUserAccountAndChannelAndPlaylist({
    userToCreate,
    userDisplayName: body.displayName || undefined,
    channelNames: body.channel
  })

  auditLogger.create(body.username, new UserAuditView(user.toFormattedJSON()))
  logger.info('User %s with its channel and account registered.', body.username)

  if (CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION) {
    await sendVerifyUserEmail(user)
  }

  Notifier.Instance.notifyOnNewDirectRegistration(user)

  Hooks.runAction('action:api.user.registered', { body, user, account, videoChannel, req, res })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}
