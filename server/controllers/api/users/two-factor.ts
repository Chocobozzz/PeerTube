import express from 'express'
import { generateOTPSecret, isOTPValid } from '@server/helpers/otp'
import { Redis } from '@server/lib/redis'
import { asyncMiddleware, authenticate, usersCheckCurrentPassword } from '@server/middlewares'
import {
  confirmTwoFactorValidator,
  disableTwoFactorValidator,
  requestOrConfirmTwoFactorValidator
} from '@server/middlewares/validators/two-factor'
import { HttpStatusCode, TwoFactorEnableResult } from '@shared/models'

const twoFactorRouter = express.Router()

twoFactorRouter.post('/:id/two-factor/request',
  authenticate,
  asyncMiddleware(usersCheckCurrentPassword),
  asyncMiddleware(requestOrConfirmTwoFactorValidator),
  asyncMiddleware(requestTwoFactor)
)

twoFactorRouter.post('/:id/two-factor/confirm-request',
  authenticate,
  asyncMiddleware(requestOrConfirmTwoFactorValidator),
  confirmTwoFactorValidator,
  asyncMiddleware(confirmRequestTwoFactor)
)

twoFactorRouter.post('/:id/two-factor/disable',
  authenticate,
  asyncMiddleware(usersCheckCurrentPassword),
  asyncMiddleware(disableTwoFactorValidator),
  asyncMiddleware(disableTwoFactor)
)

// ---------------------------------------------------------------------------

export {
  twoFactorRouter
}

// ---------------------------------------------------------------------------

async function requestTwoFactor (req: express.Request, res: express.Response) {
  const user = res.locals.user

  const { secret, uri } = generateOTPSecret(user.email)
  const requestToken = await Redis.Instance.setTwoFactorRequest(user.id, secret)

  return res.json({
    otpRequest: {
      requestToken,
      secret,
      uri
    }
  } as TwoFactorEnableResult)
}

async function confirmRequestTwoFactor (req: express.Request, res: express.Response) {
  const requestToken = req.body.requestToken
  const otpToken = req.body.otpToken
  const user = res.locals.user

  const secret = await Redis.Instance.getTwoFactorRequestToken(user.id, requestToken)
  if (!secret) {
    return res.fail({
      message: 'Invalid request token',
      status: HttpStatusCode.FORBIDDEN_403
    })
  }

  if (isOTPValid({ secret, token: otpToken }) !== true) {
    return res.fail({
      message: 'Invalid OTP token',
      status: HttpStatusCode.FORBIDDEN_403
    })
  }

  user.otpSecret = secret
  await user.save()

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function disableTwoFactor (req: express.Request, res: express.Response) {
  const user = res.locals.user

  user.otpSecret = null
  await user.save()

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}
