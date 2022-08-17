import express from 'express'
import { body, param, query } from 'express-validator'
import { Hooks } from '@server/lib/plugins/hooks'
import { MUserDefault } from '@server/types/models'
import { HttpStatusCode, UserRegister, UserRight, UserRole } from '@shared/models'
import { isBooleanValid, isIdValid, toBooleanOrNull, toIntOrNull } from '../../helpers/custom-validators/misc'
import { isThemeNameValid } from '../../helpers/custom-validators/plugins'
import {
  isUserAdminFlagsValid,
  isUserAutoPlayNextVideoValid,
  isUserAutoPlayVideoValid,
  isUserBlockedReasonValid,
  isUserDescriptionValid,
  isUserDisplayNameValid,
  isUserNoModal,
  isUserNSFWPolicyValid,
  isUserP2PEnabledValid,
  isUserPasswordValid,
  isUserPasswordValidOrEmpty,
  isUserRoleValid,
  isUserUsernameValid,
  isUserVideoLanguages,
  isUserVideoQuotaDailyValid,
  isUserVideoQuotaValid,
  isUserVideosHistoryEnabledValid
} from '../../helpers/custom-validators/users'
import { isVideoChannelDisplayNameValid, isVideoChannelUsernameValid } from '../../helpers/custom-validators/video-channels'
import { logger } from '../../helpers/logger'
import { isThemeRegistered } from '../../lib/plugins/theme-utils'
import { Redis } from '../../lib/redis'
import { isSignupAllowed, isSignupAllowedForCurrentIP } from '../../lib/signup'
import { ActorModel } from '../../models/actor/actor'
import { UserModel } from '../../models/user/user'
import { areValidationErrors, doesVideoChannelIdExist, doesVideoExist, isValidVideoIdParam } from './shared'

const usersListValidator = [
  query('blocked')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .isBoolean().withMessage('Should be a valid blocked boolena'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

const usersAddValidator = [
  body('username')
    .custom(isUserUsernameValid)
    .withMessage('Should have a valid username (lowercase alphanumeric characters)'),
  body('password')
    .custom(isUserPasswordValidOrEmpty),
  body('email')
    .isEmail(),

  body('channelName')
    .optional()
    .custom(isVideoChannelUsernameValid),

  body('videoQuota')
    .custom(isUserVideoQuotaValid),
  body('videoQuotaDaily')
    .custom(isUserVideoQuotaDailyValid),

  body('role')
    .customSanitizer(toIntOrNull)
    .custom(isUserRoleValid),

  body('adminFlags')
    .optional()
    .custom(isUserAdminFlagsValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res, { omitBodyLog: true })) return
    if (!await checkUserNameOrEmailDoesNotAlreadyExist(req.body.username, req.body.email, res)) return

    const authUser = res.locals.oauth.token.User
    if (authUser.role !== UserRole.ADMINISTRATOR && req.body.role !== UserRole.USER) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'You can only create users (and not administrators or moderators)'
      })
    }

    if (req.body.channelName) {
      if (req.body.channelName === req.body.username) {
        return res.fail({ message: 'Channel name cannot be the same as user username.' })
      }

      const existing = await ActorModel.loadLocalByName(req.body.channelName)
      if (existing) {
        return res.fail({
          status: HttpStatusCode.CONFLICT_409,
          message: `Channel with name ${req.body.channelName} already exists.`
        })
      }
    }

    return next()
  }
]

const usersRegisterValidator = [
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

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res, { omitBodyLog: true })) return
    if (!await checkUserNameOrEmailDoesNotAlreadyExist(req.body.username, req.body.email, res)) return

    const body: UserRegister = req.body
    if (body.channel) {
      if (!body.channel.name || !body.channel.displayName) {
        return res.fail({ message: 'Channel is optional but if you specify it, channel.name and channel.displayName are required.' })
      }

      if (body.channel.name === body.username) {
        return res.fail({ message: 'Channel name cannot be the same as user username.' })
      }

      const existing = await ActorModel.loadLocalByName(body.channel.name)
      if (existing) {
        return res.fail({
          status: HttpStatusCode.CONFLICT_409,
          message: `Channel with name ${body.channel.name} already exists.`
        })
      }
    }

    return next()
  }
]

const usersRemoveValidator = [
  param('id')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await checkUserIdExist(req.params.id, res)) return

    const user = res.locals.user
    if (user.username === 'root') {
      return res.fail({ message: 'Cannot remove the root user' })
    }

    return next()
  }
]

const usersBlockingValidator = [
  param('id')
    .custom(isIdValid),
  body('reason')
    .optional()
    .custom(isUserBlockedReasonValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await checkUserIdExist(req.params.id, res)) return

    const user = res.locals.user
    if (user.username === 'root') {
      return res.fail({ message: 'Cannot block the root user' })
    }

    return next()
  }
]

const deleteMeValidator = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = res.locals.oauth.token.User
    if (user.username === 'root') {
      return res.fail({ message: 'You cannot delete your root account.' })
    }

    return next()
  }
]

const usersUpdateValidator = [
  param('id').custom(isIdValid),

  body('password')
    .optional()
    .custom(isUserPasswordValid),
  body('email')
    .optional()
    .isEmail(),
  body('emailVerified')
    .optional()
    .isBoolean(),
  body('videoQuota')
    .optional()
    .custom(isUserVideoQuotaValid),
  body('videoQuotaDaily')
    .optional()
    .custom(isUserVideoQuotaDailyValid),
  body('pluginAuth')
    .optional()
    .exists(),
  body('role')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isUserRoleValid),
  body('adminFlags')
    .optional()
    .custom(isUserAdminFlagsValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res, { omitBodyLog: true })) return
    if (!await checkUserIdExist(req.params.id, res)) return

    const user = res.locals.user
    if (user.username === 'root' && req.body.role !== undefined && user.role !== req.body.role) {
      return res.fail({ message: 'Cannot change root role.' })
    }

    return next()
  }
]

const usersUpdateMeValidator = [
  body('displayName')
    .optional()
    .custom(isUserDisplayNameValid),
  body('description')
    .optional()
    .custom(isUserDescriptionValid),
  body('currentPassword')
    .optional()
    .custom(isUserPasswordValid),
  body('password')
    .optional()
    .custom(isUserPasswordValid),
  body('email')
    .optional()
    .isEmail(),
  body('nsfwPolicy')
    .optional()
    .custom(isUserNSFWPolicyValid),
  body('autoPlayVideo')
    .optional()
    .custom(isUserAutoPlayVideoValid),
  body('p2pEnabled')
    .optional()
    .custom(isUserP2PEnabledValid).withMessage('Should have a valid p2p enabled boolean'),
  body('videoLanguages')
    .optional()
    .custom(isUserVideoLanguages),
  body('videosHistoryEnabled')
    .optional()
    .custom(isUserVideosHistoryEnabledValid).withMessage('Should have a valid videos history enabled boolean'),
  body('theme')
    .optional()
    .custom(v => isThemeNameValid(v) && isThemeRegistered(v)),

  body('noInstanceConfigWarningModal')
    .optional()
    .custom(v => isUserNoModal(v)).withMessage('Should have a valid noInstanceConfigWarningModal boolean'),
  body('noWelcomeModal')
    .optional()
    .custom(v => isUserNoModal(v)).withMessage('Should have a valid noWelcomeModal boolean'),
  body('noAccountSetupWarningModal')
    .optional()
    .custom(v => isUserNoModal(v)).withMessage('Should have a valid noAccountSetupWarningModal boolean'),

  body('autoPlayNextVideo')
    .optional()
    .custom(v => isUserAutoPlayNextVideoValid(v)).withMessage('Should have a valid autoPlayNextVideo boolean'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = res.locals.oauth.token.User

    if (req.body.password || req.body.email) {
      if (user.pluginAuth !== null) {
        return res.fail({ message: 'You cannot update your email or password that is associated with an external auth system.' })
      }

      if (!req.body.currentPassword) {
        return res.fail({ message: 'currentPassword parameter is missing.' })
      }

      if (await user.isPasswordMatch(req.body.currentPassword) !== true) {
        return res.fail({
          status: HttpStatusCode.UNAUTHORIZED_401,
          message: 'currentPassword is invalid.'
        })
      }
    }

    if (areValidationErrors(req, res, { omitBodyLog: true })) return

    return next()
  }
]

const usersGetValidator = [
  param('id')
    .custom(isIdValid),
  query('withStats')
    .optional()
    .isBoolean().withMessage('Should have a valid withStats boolean'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await checkUserIdExist(req.params.id, res, req.query.withStats)) return

    return next()
  }
]

const usersVideoRatingValidator = [
  isValidVideoIdParam('videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'id')) return

    return next()
  }
]

const usersVideosValidator = [
  query('isLive')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have a valid isLive boolean'),

  query('channelId')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (req.query.channelId && !await doesVideoChannelIdExist(req.query.channelId, res)) return

    return next()
  }
]

const ensureUserRegistrationAllowed = [
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const allowedParams = {
      body: req.body,
      ip: req.ip
    }

    const allowedResult = await Hooks.wrapPromiseFun(
      isSignupAllowed,
      allowedParams,
      'filter:api.user.signup.allowed.result'
    )

    if (allowedResult.allowed === false) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: allowedResult.errorMessage || 'User registration is not enabled or user limit is reached.'
      })
    }

    return next()
  }
]

const ensureUserRegistrationAllowedForIP = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const allowed = isSignupAllowedForCurrentIP(req.ip)

    if (allowed === false) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'You are not on a network authorized for registration.'
      })
    }

    return next()
  }
]

const usersAskResetPasswordValidator = [
  body('email')
    .isEmail(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const exists = await checkUserEmailExist(req.body.email, res, false)
    if (!exists) {
      logger.debug('User with email %s does not exist (asking reset password).', req.body.email)
      // Do not leak our emails
      return res.status(HttpStatusCode.NO_CONTENT_204).end()
    }

    return next()
  }
]

const usersResetPasswordValidator = [
  param('id')
    .custom(isIdValid),
  body('verificationString')
    .not().isEmpty(),
  body('password')
    .custom(isUserPasswordValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await checkUserIdExist(req.params.id, res)) return

    const user = res.locals.user
    const redisVerificationString = await Redis.Instance.getResetPasswordLink(user.id)

    if (redisVerificationString !== req.body.verificationString) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Invalid verification string.'
      })
    }

    return next()
  }
]

const usersAskSendVerifyEmailValidator = [
  body('email').isEmail().not().isEmpty().withMessage('Should have a valid email'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const exists = await checkUserEmailExist(req.body.email, res, false)
    if (!exists) {
      logger.debug('User with email %s does not exist (asking verify email).', req.body.email)
      // Do not leak our emails
      return res.status(HttpStatusCode.NO_CONTENT_204).end()
    }

    return next()
  }
]

const usersVerifyEmailValidator = [
  param('id')
    .isInt().not().isEmpty().withMessage('Should have a valid id'),

  body('verificationString')
    .not().isEmpty().withMessage('Should have a valid verification string'),
  body('isPendingEmail')
    .optional()
    .customSanitizer(toBooleanOrNull),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await checkUserIdExist(req.params.id, res)) return

    const user = res.locals.user
    const redisVerificationString = await Redis.Instance.getVerifyEmailLink(user.id)

    if (redisVerificationString !== req.body.verificationString) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Invalid verification string.'
      })
    }

    return next()
  }
]

const userAutocompleteValidator = [
  param('search')
    .isString()
    .not().isEmpty()
]

const ensureAuthUserOwnsAccountValidator = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = res.locals.oauth.token.User

    if (res.locals.account.id !== user.Account.id) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Only owner of this account can access this resource.'
      })
    }

    return next()
  }
]

const ensureCanManageChannel = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = res.locals.oauth.token.user
    const isUserOwner = res.locals.videoChannel.Account.userId === user.id

    if (!isUserOwner && user.hasRight(UserRight.MANAGE_ANY_VIDEO_CHANNEL) === false) {
      const message = `User ${user.username} does not have right to manage channel ${req.params.nameWithHost}.`

      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message
      })
    }

    return next()
  }
]

const ensureCanManageUser = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authUser = res.locals.oauth.token.User
    const onUser = res.locals.user

    if (authUser.role === UserRole.ADMINISTRATOR) return next()
    if (authUser.role === UserRole.MODERATOR && onUser.role === UserRole.USER) return next()

    return res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'A moderator can only manager users.'
    })
  }
]

// ---------------------------------------------------------------------------

export {
  usersListValidator,
  usersAddValidator,
  deleteMeValidator,
  usersRegisterValidator,
  usersBlockingValidator,
  usersRemoveValidator,
  usersUpdateValidator,
  usersUpdateMeValidator,
  usersVideoRatingValidator,
  ensureUserRegistrationAllowed,
  ensureUserRegistrationAllowedForIP,
  usersGetValidator,
  usersVideosValidator,
  usersAskResetPasswordValidator,
  usersResetPasswordValidator,
  usersAskSendVerifyEmailValidator,
  usersVerifyEmailValidator,
  userAutocompleteValidator,
  ensureAuthUserOwnsAccountValidator,
  ensureCanManageUser,
  ensureCanManageChannel
}

// ---------------------------------------------------------------------------

function checkUserIdExist (idArg: number | string, res: express.Response, withStats = false) {
  const id = parseInt(idArg + '', 10)
  return checkUserExist(() => UserModel.loadByIdWithChannels(id, withStats), res)
}

function checkUserEmailExist (email: string, res: express.Response, abortResponse = true) {
  return checkUserExist(() => UserModel.loadByEmail(email), res, abortResponse)
}

async function checkUserNameOrEmailDoesNotAlreadyExist (username: string, email: string, res: express.Response) {
  const user = await UserModel.loadByUsernameOrEmail(username, email)

  if (user) {
    res.fail({
      status: HttpStatusCode.CONFLICT_409,
      message: 'User with this username or email already exists.'
    })
    return false
  }

  const actor = await ActorModel.loadLocalByName(username)
  if (actor) {
    res.fail({
      status: HttpStatusCode.CONFLICT_409,
      message: 'Another actor (account/channel) with this name on this instance already exists or has already existed.'
    })
    return false
  }

  return true
}

async function checkUserExist (finder: () => Promise<MUserDefault>, res: express.Response, abortResponse = true) {
  const user = await finder()

  if (!user) {
    if (abortResponse === true) {
      res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'User not found'
      })
    }

    return false
  }

  res.locals.user = user
  return true
}
