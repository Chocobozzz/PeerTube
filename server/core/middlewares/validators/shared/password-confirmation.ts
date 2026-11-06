import { HttpStatusCode, ServerErrorCode } from '@peertube/peertube-models'
import { isUserPasswordTooLong } from '@server/helpers/custom-validators/users.js'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import {
  canUserConfirmPassword,
  consumePasswordConfirmationAttempt,
  isUserCurrentPasswordValid,
  resetPasswordConfirmationFailures
} from '@server/lib/auth/password-confirmation.js'
import express from 'express'

const logger = createLogger()

// Sensitive admin actions require the user to type their password again
// Password must be in `currentPassword` body field
export async function checkPasswordConfirmation (req: express.Request, res: express.Response) {
  if (CONFIG.SECURITY.PASSWORD_CONFIRMATION.ENABLED !== true) return true

  const user = res.locals.oauth.token.User

  if (!canUserConfirmPassword(user)) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      type: ServerErrorCode.PASSWORD_CONFIRMATION_UNAVAILABLE,
      message: req.t(
        'This action requires a password confirmation, but your account uses an external authentication. ' +
          'Ask your system administrator to disable security.password_confirmation in the configuration file.'
      )
    })
    return false
  }

  const currentPassword = req.body.currentPassword
  if (!currentPassword || typeof currentPassword !== 'string') {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      type: ServerErrorCode.CURRENT_PASSWORD_IS_MISSING,
      message: req.t('This action requires a password confirmation: currentPassword is missing.')
    })
    return false
  }

  // Plugin passwords are checked by the plugin, not by bcrypt
  if (!user.pluginAuth && !checkLocalPasswordLength(currentPassword, req, res)) return false

  if (!await consumePasswordConfirmationAttempt(user)) {
    res.fail({
      status: HttpStatusCode.TOO_MANY_REQUESTS_429,
      message: req.t('Too many failed password confirmations, please try again later.')
    })
    return false
  }

  if (await isUserCurrentPasswordValid(user, currentPassword) !== true) {
    logger.warn(`Invalid password confirmation of user ${user.username}`, { userId: user.id, ip: req.ip, path: req.originalUrl })

    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      type: ServerErrorCode.CURRENT_PASSWORD_IS_INVALID,
      message: req.t('currentPassword is invalid.')
    })
    return false
  }

  await resetPasswordConfirmationFailures(user)

  return true
}

// Local passwords are compared with bcrypt, that cannot handle long passwords
export function checkLocalPasswordLength (password: string, req: express.Request, res: express.Response) {
  if (!isUserPasswordTooLong(password)) return true

  res.fail({
    status: HttpStatusCode.BAD_REQUEST_400,
    message: req.t('Password is too long. Please reset it using the password reset procedure.'),
    type: ServerErrorCode.TOO_LONG_PASSWORD
  })

  return false
}
