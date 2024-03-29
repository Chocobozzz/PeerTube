import express from 'express'
import { body, param, query } from 'express-validator'
import { forceNumber } from '@peertube/peertube-core-utils'
import { HttpStatusCode, UserRight, UserRole } from '@peertube/peertube-models'
import { exists, isBooleanValid, isIdValid, toBooleanOrNull, toIntOrNull } from '../../../helpers/custom-validators/misc.js'
import { isThemeNameValid } from '../../../helpers/custom-validators/plugins.js'
import {
  isUserAdminFlagsValid,
  isUserAutoPlayNextVideoValid,
  isUserAutoPlayVideoValid,
  isUserBlockedReasonValid,
  isUserDescriptionValid,
  isUserDisplayNameValid,
  isUserEmailPublicValid,
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
} from '../../../helpers/custom-validators/users.js'
import { isVideoChannelUsernameValid } from '../../../helpers/custom-validators/video-channels.js'
import { logger } from '../../../helpers/logger.js'
import { isThemeRegistered } from '../../../lib/plugins/theme-utils.js'
import { Redis } from '../../../lib/redis.js'
import { ActorModel } from '../../../models/actor/actor.js'
import {
  areValidationErrors,
  checkUserEmailExist,
  checkUserIdExist,
  checkUserNameOrEmailDoNotAlreadyExist,
  checkUserCanManageAccount,
  doesVideoChannelIdExist,
  doesVideoExist,
  isValidVideoIdParam
} from '../shared/index.js'

const usersListValidator = [
  query('blocked')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .isBoolean().withMessage('Should be a valid blocked boolean'),

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
    .optional()
    .custom(isUserVideoQuotaValid),

  body('videoQuotaDaily')
    .optional()
    .custom(isUserVideoQuotaDailyValid),

  body('role')
    .customSanitizer(toIntOrNull)
    .custom(isUserRoleValid),

  body('adminFlags')
    .optional()
    .custom(isUserAdminFlagsValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res, { omitBodyLog: true })) return
    if (!await checkUserNameOrEmailDoNotAlreadyExist(req.body.username, req.body.email, res)) return

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
  body('emailPublic')
    .optional()
    .custom(isUserEmailPublicValid),
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

    if (res.locals.user.pluginAuth) {
      return res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: 'Cannot recover password of a user that uses a plugin authentication.'
      })
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
    const redisVerificationString = await Redis.Instance.getResetPasswordVerificationString(user.id)

    if (redisVerificationString !== req.body.verificationString) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Invalid verification string.'
      })
    }

    return next()
  }
]

const usersCheckCurrentPasswordFactory = (targetUserIdGetter: (req: express.Request) => number | string) => {
  return [
    body('currentPassword').optional().custom(exists),

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (areValidationErrors(req, res)) return

      const user = res.locals.oauth.token.User
      const isAdminOrModerator = user.role === UserRole.ADMINISTRATOR || user.role === UserRole.MODERATOR
      const targetUserId = forceNumber(targetUserIdGetter(req))

      // Admin/moderator action on another user, skip the password check
      if (isAdminOrModerator && targetUserId !== user.id) {
        return next()
      }

      if (!req.body.currentPassword) {
        return res.fail({
          status: HttpStatusCode.BAD_REQUEST_400,
          message: 'currentPassword is missing'
        })
      }

      if (await user.isPasswordMatch(req.body.currentPassword) !== true) {
        return res.fail({
          status: HttpStatusCode.FORBIDDEN_403,
          message: 'currentPassword is invalid.'
        })
      }

      return next()
    }
  ]
}

const userAutocompleteValidator = [
  param('search')
    .isString()
    .not().isEmpty()
]

const ensureAuthUserOwnsAccountValidator = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = res.locals.oauth.token.User

    if (!checkUserCanManageAccount({ user, account: res.locals.account, specialRight: null, res })) return

    return next()
  }
]

const ensureCanManageChannelOrAccount = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = res.locals.oauth.token.user
    const account = res.locals.videoChannel?.Account ?? res.locals.account

    if (!checkUserCanManageAccount({ account, user, res, specialRight: UserRight.MANAGE_ANY_VIDEO_CHANNEL })) return

    return next()
  }
]

const ensureCanModerateUser = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authUser = res.locals.oauth.token.User
    const onUser = res.locals.user

    if (authUser.role === UserRole.ADMINISTRATOR) return next()
    if (authUser.role === UserRole.MODERATOR && onUser.role === UserRole.USER) return next()

    return res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Users can only be managed by moderators or admins.'
    })
  }
]

// ---------------------------------------------------------------------------

export {
  usersListValidator,
  usersAddValidator,
  deleteMeValidator,
  usersBlockingValidator,
  usersRemoveValidator,
  usersUpdateValidator,
  usersUpdateMeValidator,
  usersVideoRatingValidator,
  usersCheckCurrentPasswordFactory,
  usersGetValidator,
  usersVideosValidator,
  usersAskResetPasswordValidator,
  usersResetPasswordValidator,
  userAutocompleteValidator,
  ensureAuthUserOwnsAccountValidator,
  ensureCanModerateUser,
  ensureCanManageChannelOrAccount
}
