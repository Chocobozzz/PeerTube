import * as Bluebird from 'bluebird'
import * as express from 'express'
import { body, param, query } from 'express-validator'
import { omit } from 'lodash'
import { isIdOrUUIDValid, toBooleanOrNull, toIntOrNull } from '../../helpers/custom-validators/misc'
import {
  isNoInstanceConfigWarningModal,
  isNoWelcomeModal,
  isUserAdminFlagsValid,
  isUserAutoPlayNextVideoValid,
  isUserAutoPlayVideoValid,
  isUserBlockedReasonValid,
  isUserDescriptionValid,
  isUserDisplayNameValid,
  isUserNSFWPolicyValid,
  isUserPasswordValid,
  isUserPasswordValidOrEmpty,
  isUserRoleValid,
  isUserUsernameValid,
  isUserVideoLanguages,
  isUserVideoQuotaDailyValid,
  isUserVideoQuotaValid,
  isUserVideosHistoryEnabledValid
} from '../../helpers/custom-validators/users'
import { logger } from '../../helpers/logger'
import { isSignupAllowed, isSignupAllowedForCurrentIP } from '../../helpers/signup'
import { Redis } from '../../lib/redis'
import { UserModel } from '../../models/account/user'
import { areValidationErrors } from './utils'
import { ActorModel } from '../../models/activitypub/actor'
import { isActorPreferredUsernameValid } from '../../helpers/custom-validators/activitypub/actor'
import { isVideoChannelNameValid } from '../../helpers/custom-validators/video-channels'
import { UserRegister } from '../../../shared/models/users/user-register.model'
import { isThemeNameValid } from '../../helpers/custom-validators/plugins'
import { isThemeRegistered } from '../../lib/plugins/theme-utils'
import { doesVideoExist } from '../../helpers/middlewares'
import { UserRole } from '../../../shared/models/users'
import { MUserDefault } from '@server/types/models'
import { Hooks } from '@server/lib/plugins/hooks'

const usersListValidator = [
  query('blocked')
    .optional()
    .isBoolean().withMessage('Should be a valid boolean banned state'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking usersList parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const usersAddValidator = [
  body('username').custom(isUserUsernameValid).withMessage('Should have a valid username (lowercase alphanumeric characters)'),
  body('password').custom(isUserPasswordValidOrEmpty).withMessage('Should have a valid password'),
  body('email').isEmail().withMessage('Should have a valid email'),
  body('videoQuota').custom(isUserVideoQuotaValid).withMessage('Should have a valid user quota'),
  body('videoQuotaDaily').custom(isUserVideoQuotaDailyValid).withMessage('Should have a valid daily user quota'),
  body('role')
    .customSanitizer(toIntOrNull)
    .custom(isUserRoleValid).withMessage('Should have a valid role'),
  body('adminFlags').optional().custom(isUserAdminFlagsValid).withMessage('Should have a valid admin flags'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking usersAdd parameters', { parameters: omit(req.body, 'password') })

    if (areValidationErrors(req, res)) return
    if (!await checkUserNameOrEmailDoesNotAlreadyExist(req.body.username, req.body.email, res)) return

    const authUser = res.locals.oauth.token.User
    if (authUser.role !== UserRole.ADMINISTRATOR && req.body.role !== UserRole.USER) {
      return res.status(403)
        .json({ error: 'You can only create users (and not administrators or moderators)' })
    }

    return next()
  }
]

const usersRegisterValidator = [
  body('username').custom(isUserUsernameValid).withMessage('Should have a valid username'),
  body('password').custom(isUserPasswordValid).withMessage('Should have a valid password'),
  body('email').isEmail().withMessage('Should have a valid email'),
  body('displayName')
    .optional()
    .custom(isUserDisplayNameValid).withMessage('Should have a valid display name'),

  body('channel.name')
    .optional()
    .custom(isActorPreferredUsernameValid).withMessage('Should have a valid channel name'),
  body('channel.displayName')
    .optional()
    .custom(isVideoChannelNameValid).withMessage('Should have a valid display name'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking usersRegister parameters', { parameters: omit(req.body, 'password') })

    if (areValidationErrors(req, res)) return
    if (!await checkUserNameOrEmailDoesNotAlreadyExist(req.body.username, req.body.email, res)) return

    const body: UserRegister = req.body
    if (body.channel) {
      if (!body.channel.name || !body.channel.displayName) {
        return res.status(400)
          .json({ error: 'Channel is optional but if you specify it, channel.name and channel.displayName are required.' })
      }

      if (body.channel.name === body.username) {
        return res.status(400)
                  .json({ error: 'Channel name cannot be the same as user username.' })
      }

      const existing = await ActorModel.loadLocalByName(body.channel.name)
      if (existing) {
        return res.status(409)
                  .json({ error: `Channel with name ${body.channel.name} already exists.` })
      }
    }

    return next()
  }
]

const usersRemoveValidator = [
  param('id').isInt().not().isEmpty().withMessage('Should have a valid id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking usersRemove parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await checkUserIdExist(req.params.id, res)) return

    const user = res.locals.user
    if (user.username === 'root') {
      return res.status(400)
                .json({ error: 'Cannot remove the root user' })
    }

    return next()
  }
]

const usersBlockingValidator = [
  param('id').isInt().not().isEmpty().withMessage('Should have a valid id'),
  body('reason').optional().custom(isUserBlockedReasonValid).withMessage('Should have a valid blocking reason'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking usersBlocking parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await checkUserIdExist(req.params.id, res)) return

    const user = res.locals.user
    if (user.username === 'root') {
      return res.status(400)
                .json({ error: 'Cannot block the root user' })
    }

    return next()
  }
]

const deleteMeValidator = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = res.locals.oauth.token.User
    if (user.username === 'root') {
      return res.status(400)
                .json({ error: 'You cannot delete your root account.' })
                .end()
    }

    return next()
  }
]

const usersUpdateValidator = [
  param('id').isInt().not().isEmpty().withMessage('Should have a valid id'),
  body('password').optional().custom(isUserPasswordValid).withMessage('Should have a valid password'),
  body('email').optional().isEmail().withMessage('Should have a valid email attribute'),
  body('emailVerified').optional().isBoolean().withMessage('Should have a valid email verified attribute'),
  body('videoQuota').optional().custom(isUserVideoQuotaValid).withMessage('Should have a valid user quota'),
  body('videoQuotaDaily').optional().custom(isUserVideoQuotaDailyValid).withMessage('Should have a valid daily user quota'),
  body('role')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isUserRoleValid).withMessage('Should have a valid role'),
  body('adminFlags').optional().custom(isUserAdminFlagsValid).withMessage('Should have a valid admin flags'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking usersUpdate parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await checkUserIdExist(req.params.id, res)) return

    const user = res.locals.user
    if (user.username === 'root' && req.body.role !== undefined && user.role !== req.body.role) {
      return res.status(400)
        .json({ error: 'Cannot change root role.' })
    }

    return next()
  }
]

const usersUpdateMeValidator = [
  body('displayName')
    .optional()
    .custom(isUserDisplayNameValid).withMessage('Should have a valid display name'),
  body('description')
    .optional()
    .custom(isUserDescriptionValid).withMessage('Should have a valid description'),
  body('currentPassword')
    .optional()
    .custom(isUserPasswordValid).withMessage('Should have a valid current password'),
  body('password')
    .optional()
    .custom(isUserPasswordValid).withMessage('Should have a valid password'),
  body('email')
    .optional()
    .isEmail().withMessage('Should have a valid email attribute'),
  body('nsfwPolicy')
    .optional()
    .custom(isUserNSFWPolicyValid).withMessage('Should have a valid display Not Safe For Work policy'),
  body('autoPlayVideo')
    .optional()
    .custom(isUserAutoPlayVideoValid).withMessage('Should have a valid automatically plays video attribute'),
  body('videoLanguages')
    .optional()
    .custom(isUserVideoLanguages).withMessage('Should have a valid video languages attribute'),
  body('videosHistoryEnabled')
    .optional()
    .custom(isUserVideosHistoryEnabledValid).withMessage('Should have a valid videos history enabled attribute'),
  body('theme')
    .optional()
    .custom(v => isThemeNameValid(v) && isThemeRegistered(v)).withMessage('Should have a valid theme'),
  body('noInstanceConfigWarningModal')
    .optional()
    .custom(v => isNoInstanceConfigWarningModal(v)).withMessage('Should have a valid noInstanceConfigWarningModal boolean'),
  body('noWelcomeModal')
    .optional()
    .custom(v => isNoWelcomeModal(v)).withMessage('Should have a valid noWelcomeModal boolean'),
  body('autoPlayNextVideo')
    .optional()
    .custom(v => isUserAutoPlayNextVideoValid(v)).withMessage('Should have a valid autoPlayNextVideo boolean'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking usersUpdateMe parameters', { parameters: omit(req.body, 'password') })

    const user = res.locals.oauth.token.User

    if (req.body.password || req.body.email) {
      if (user.pluginAuth !== null) {
        return res.status(400)
                  .json({ error: 'You cannot update your email or password that is associated with an external auth system.' })
      }

      if (!req.body.currentPassword) {
        return res.status(400)
                  .json({ error: 'currentPassword parameter is missing.' })
      }

      if (await user.isPasswordMatch(req.body.currentPassword) !== true) {
        return res.status(401)
                  .json({ error: 'currentPassword is invalid.' })
      }
    }

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const usersGetValidator = [
  param('id').isInt().not().isEmpty().withMessage('Should have a valid id'),
  query('withStats').optional().isBoolean().withMessage('Should have a valid stats flag'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking usersGet parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await checkUserIdExist(req.params.id, res, req.query.withStats)) return

    return next()
  }
]

const usersVideoRatingValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid video id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking usersVideoRating parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'id')) return

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
      return res.status(403)
                .json({ error: allowedResult.errorMessage || 'User registration is not enabled or user limit is reached.' })
    }

    return next()
  }
]

const ensureUserRegistrationAllowedForIP = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const allowed = isSignupAllowedForCurrentIP(req.ip)

    if (allowed === false) {
      return res.status(403)
                .json({ error: 'You are not on a network authorized for registration.' })
    }

    return next()
  }
]

const usersAskResetPasswordValidator = [
  body('email').isEmail().not().isEmpty().withMessage('Should have a valid email'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking usersAskResetPassword parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    const exists = await checkUserEmailExist(req.body.email, res, false)
    if (!exists) {
      logger.debug('User with email %s does not exist (asking reset password).', req.body.email)
      // Do not leak our emails
      return res.status(204).end()
    }

    return next()
  }
]

const usersResetPasswordValidator = [
  param('id').isInt().not().isEmpty().withMessage('Should have a valid id'),
  body('verificationString').not().isEmpty().withMessage('Should have a valid verification string'),
  body('password').custom(isUserPasswordValid).withMessage('Should have a valid password'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking usersResetPassword parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await checkUserIdExist(req.params.id, res)) return

    const user = res.locals.user
    const redisVerificationString = await Redis.Instance.getResetPasswordLink(user.id)

    if (redisVerificationString !== req.body.verificationString) {
      return res
        .status(403)
        .json({ error: 'Invalid verification string.' })
    }

    return next()
  }
]

const usersAskSendVerifyEmailValidator = [
  body('email').isEmail().not().isEmpty().withMessage('Should have a valid email'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking askUsersSendVerifyEmail parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    const exists = await checkUserEmailExist(req.body.email, res, false)
    if (!exists) {
      logger.debug('User with email %s does not exist (asking verify email).', req.body.email)
      // Do not leak our emails
      return res.status(204).end()
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
    logger.debug('Checking usersVerifyEmail parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await checkUserIdExist(req.params.id, res)) return

    const user = res.locals.user
    const redisVerificationString = await Redis.Instance.getVerifyEmailLink(user.id)

    if (redisVerificationString !== req.body.verificationString) {
      return res
        .status(403)
        .json({ error: 'Invalid verification string.' })
    }

    return next()
  }
]

const userAutocompleteValidator = [
  param('search').isString().not().isEmpty().withMessage('Should have a search parameter')
]

const ensureAuthUserOwnsAccountValidator = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = res.locals.oauth.token.User

    if (res.locals.account.id !== user.Account.id) {
      return res.status(403)
                .json({ error: 'Only owner can access ratings list.' })
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

    return res.status(403)
      .json({ error: 'A moderator can only manager users.' })
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
  usersAskResetPasswordValidator,
  usersResetPasswordValidator,
  usersAskSendVerifyEmailValidator,
  usersVerifyEmailValidator,
  userAutocompleteValidator,
  ensureAuthUserOwnsAccountValidator,
  ensureCanManageUser
}

// ---------------------------------------------------------------------------

function checkUserIdExist (idArg: number | string, res: express.Response, withStats = false) {
  const id = parseInt(idArg + '', 10)
  return checkUserExist(() => UserModel.loadById(id, withStats), res)
}

function checkUserEmailExist (email: string, res: express.Response, abortResponse = true) {
  return checkUserExist(() => UserModel.loadByEmail(email), res, abortResponse)
}

async function checkUserNameOrEmailDoesNotAlreadyExist (username: string, email: string, res: express.Response) {
  const user = await UserModel.loadByUsernameOrEmail(username, email)

  if (user) {
    res.status(409)
              .json({ error: 'User with this username or email already exists.' })
    return false
  }

  const actor = await ActorModel.loadLocalByName(username)
  if (actor) {
    res.status(409)
       .json({ error: 'Another actor (account/channel) with this name on this instance already exists or has already existed.' })
    return false
  }

  return true
}

async function checkUserExist (finder: () => Bluebird<MUserDefault>, res: express.Response, abortResponse = true) {
  const user = await finder()

  if (!user) {
    if (abortResponse === true) {
      res.status(404)
        .json({ error: 'User not found' })
    }

    return false
  }

  res.locals.user = user

  return true
}
