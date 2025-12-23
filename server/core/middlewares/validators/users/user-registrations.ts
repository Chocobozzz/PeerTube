import { HttpStatusCode, UserRegister, UserRegistrationRequest, UserRegistrationState } from '@peertube/peertube-models'
import { exists, isBooleanValid, isIdValid, toBooleanOrNull } from '@server/helpers/custom-validators/misc.js'
import { isRegistrationModerationResponseValid, isRegistrationReasonValid } from '@server/helpers/custom-validators/user-registration.js'
import { CONFIG } from '@server/initializers/config.js'
import { loadReservedActorName } from '@server/lib/local-actor.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import express from 'express'
import { body, param, query, ValidationChain } from 'express-validator'
import { isUserDisplayNameValid, isUserPasswordValid, isUserUsernameValid } from '../../../helpers/custom-validators/users.js'
import { isVideoChannelDisplayNameValid, isVideoChannelUsernameValid } from '../../../helpers/custom-validators/video-channels.js'
import { isSignupAllowed, isSignupAllowedForCurrentIP, SignupMode } from '../../../lib/signup.js'
import { areValidationErrors, checkUsernameOrEmailDoNotAlreadyExist } from '../shared/index.js'
import { checkRegistrationHandlesDoNotAlreadyExist, checkRegistrationIdExist } from './shared/user-registrations.js'

const usersDirectRegistrationValidator = usersCommonRegistrationValidatorFactory()

const usersRequestRegistrationValidator = [
  ...usersCommonRegistrationValidatorFactory([
    body('registrationReason')
      .custom(isRegistrationReasonValid)
  ]),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body: UserRegistrationRequest = req.body

    if (CONFIG.SIGNUP.REQUIRES_APPROVAL !== true) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: req.t('Signup approval is not enabled on this instance')
      })
    }

    const options = { username: body.username, email: body.email, channelHandle: body.channel?.name, res }
    if (!await checkRegistrationHandlesDoNotAlreadyExist(options)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

function ensureUserRegistrationAllowedFactory (signupMode: SignupMode) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const allowedParams = {
      body: req.body,
      ip: req.ip,
      signupMode
    }

    const allowedResult = await Hooks.wrapPromiseFun(
      isSignupAllowed,
      allowedParams,
      signupMode === 'direct-registration'
        ? 'filter:api.user.signup.allowed.result'
        : 'filter:api.user.request-signup.allowed.result'
    )

    if (allowedResult.allowed === false) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: allowedResult.errorMessage || req.t('User registration is not allowed')
      })
    }

    return next()
  }
}

const ensureUserRegistrationAllowedForIP = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const allowed = isSignupAllowedForCurrentIP(req.ip)

    if (allowed === false) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: req.t('You are not on a network authorized for registration.')
      })
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

const acceptOrRejectRegistrationValidator = [
  param('registrationId')
    .custom(isIdValid),

  body('moderationResponse')
    .custom(isRegistrationModerationResponseValid),

  body('preventEmailDelivery')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have preventEmailDelivery boolean'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await checkRegistrationIdExist(req.params.registrationId, res)) return

    if (res.locals.userRegistration.state !== UserRegistrationState.PENDING) {
      return res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: req.t('This registration is already accepted or rejected.')
      })
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

const getRegistrationValidator = [
  param('registrationId')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await checkRegistrationIdExist(req.params.registrationId, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

const listRegistrationsValidator = [
  query('search')
    .optional()
    .custom(exists),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  acceptOrRejectRegistrationValidator,
  ensureUserRegistrationAllowedFactory,
  ensureUserRegistrationAllowedForIP,
  getRegistrationValidator,
  listRegistrationsValidator,
  usersDirectRegistrationValidator,
  usersRequestRegistrationValidator
}

// ---------------------------------------------------------------------------

function usersCommonRegistrationValidatorFactory (additionalValidationChain: ValidationChain[] = []) {
  return [
    body('username')
      .custom(isUserUsernameValid),
    body('password')
      .custom(isUserPasswordValid),
    body('email')
      .isEmail(),
    body('displayName')
      .optional()
      .custom(isUserDisplayNameValid),

    body('channel.name')
      .optional()
      .custom(isVideoChannelUsernameValid),
    body('channel.displayName')
      .optional()
      .custom(isVideoChannelDisplayNameValid),

    ...additionalValidationChain,

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (areValidationErrors(req, res, { omitBodyLog: true })) return

      const body: UserRegister | UserRegistrationRequest = req.body

      if (!await checkUsernameOrEmailDoNotAlreadyExist({ username: body.username, email: body.email, req, res })) return

      if (body.channel) {
        if (!body.channel.name || !body.channel.displayName) {
          return res.fail({
            message: req.t('Channel is optional but if you specify it, channel.name and channel.displayName are required.')
          })
        }

        if (body.channel.name === body.username) {
          return res.fail({ message: req.t('Channel name cannot be the same as user username.') })
        }

        const existing = await loadReservedActorName(body.channel.name)
        if (existing) {
          return res.fail({
            status: HttpStatusCode.CONFLICT_409,
            message: req.t(`Channel with name {name} already exists.`, { name: body.channel.name })
          })
        }
      }

      return next()
    }
  ]
}
