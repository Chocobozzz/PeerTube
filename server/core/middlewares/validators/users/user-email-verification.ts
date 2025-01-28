import { HttpStatusCode } from '@peertube/peertube-models'
import { toBooleanOrNull } from '@server/helpers/custom-validators/misc.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import express from 'express'
import { body, param } from 'express-validator'
import { logger } from '../../../helpers/logger.js'
import { Redis } from '../../../lib/redis.js'
import { areValidationErrors, checkUserEmailExistPermissive, checkUserIdExist } from '../shared/index.js'
import { checkRegistrationEmailExistPermissive, checkRegistrationIdExist } from './shared/user-registrations.js'

export const usersAskSendVerifyEmailValidator = [
  body('email').isEmail().not().isEmpty().withMessage('Should have a valid email'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const { email } = await Hooks.wrapObject({
      email: req.body.email
    }, 'filter:api.email-verification.ask-send-verify-email.body')

    const [ userExists, registrationExists ] = await Promise.all([
      checkUserEmailExistPermissive(email, res, false),
      checkRegistrationEmailExistPermissive(email, res, false)
    ])

    if (!userExists && !registrationExists) {
      logger.debug('User or registration with email %s does not exist (asking verify email).', email)
      // Do not leak our emails
      return res.status(HttpStatusCode.NO_CONTENT_204).end()
    }

    if (res.locals.user?.pluginAuth) {
      return res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: 'Cannot ask verification email of a user that uses a plugin authentication.'
      })
    }

    return next()
  }
]

export const usersVerifyEmailValidator = [
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
    const redisVerificationString = await Redis.Instance.getUserVerifyEmailLink(user.id)

    if (redisVerificationString !== req.body.verificationString) {
      return res.fail({ status: HttpStatusCode.FORBIDDEN_403, message: 'Invalid verification string.' })
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export const registrationVerifyEmailValidator = [
  param('registrationId')
    .isInt().not().isEmpty().withMessage('Should have a valid registrationId'),

  body('verificationString')
    .not().isEmpty().withMessage('Should have a valid verification string'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await checkRegistrationIdExist(req.params.registrationId, res)) return

    const registration = res.locals.userRegistration
    const redisVerificationString = await Redis.Instance.getRegistrationVerifyEmailLink(registration.id)

    if (redisVerificationString !== req.body.verificationString) {
      return res.fail({ status: HttpStatusCode.FORBIDDEN_403, message: 'Invalid verification string.' })
    }

    return next()
  }
]
