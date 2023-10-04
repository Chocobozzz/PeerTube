import express from 'express'
import { body, param } from 'express-validator'
import { HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { exists, isIdValid } from '../../helpers/custom-validators/misc.js'
import { areValidationErrors, checkUserIdExist } from './shared/index.js'

const requestOrConfirmTwoFactorValidator = [
  param('id').custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await checkCanEnableOrDisableTwoFactor(req.params.id, res)) return

    if (res.locals.user.otpSecret) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: `Two factor is already enabled.`
      })
    }

    return next()
  }
]

const confirmTwoFactorValidator = [
  body('requestToken').custom(exists),
  body('otpToken').custom(exists),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

const disableTwoFactorValidator = [
  param('id').custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await checkCanEnableOrDisableTwoFactor(req.params.id, res)) return

    if (!res.locals.user.otpSecret) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: `Two factor is already disabled.`
      })
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  requestOrConfirmTwoFactorValidator,
  confirmTwoFactorValidator,
  disableTwoFactorValidator
}

// ---------------------------------------------------------------------------

async function checkCanEnableOrDisableTwoFactor (userId: number | string, res: express.Response) {
  const authUser = res.locals.oauth.token.user

  if (!await checkUserIdExist(userId, res)) return

  if (res.locals.user.id !== authUser.id && authUser.hasRight(UserRight.MANAGE_USERS) !== true) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: `User ${authUser.username} does not have right to change two factor setting of this user.`
    })

    return false
  }

  return true
}
