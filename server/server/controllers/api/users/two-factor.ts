import express from 'express'
import { generateOTPSecret, isOTPValid } from '@server/helpers/otp.js'
import { encrypt } from '@server/helpers/peertube-crypto.js'
import { CONFIG } from '@server/initializers/config.js'
import { Redis } from '@server/lib/redis.js'
import { asyncMiddleware, authenticate, usersCheckCurrentPasswordFactory } from '@server/middlewares/index.js'
import {
  confirmTwoFactorValidator,
  disableTwoFactorValidator,
  requestOrConfirmTwoFactorValidator
} from '@server/middlewares/validators/two-factor.js'
import { HttpStatusCode, TwoFactorEnableResult } from '@peertube/peertube-models'

const twoFactorRouter = express.Router()

twoFactorRouter.post('/:id/two-factor/request',
  authenticate,
  asyncMiddleware(usersCheckCurrentPasswordFactory(req => req.params.id)),
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
  asyncMiddleware(usersCheckCurrentPasswordFactory(req => req.params.id)),
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

  const encryptedSecret = await encrypt(secret, CONFIG.SECRETS.PEERTUBE)
  const requestToken = await Redis.Instance.setTwoFactorRequest(user.id, encryptedSecret)

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

  const encryptedSecret = await Redis.Instance.getTwoFactorRequestToken(user.id, requestToken)
  if (!encryptedSecret) {
    return res.fail({
      message: 'Invalid request token',
      status: HttpStatusCode.FORBIDDEN_403
    })
  }

  if (await isOTPValid({ encryptedSecret, token: otpToken }) !== true) {
    return res.fail({
      message: 'Invalid OTP token',
      status: HttpStatusCode.FORBIDDEN_403
    })
  }

  user.otpSecret = encryptedSecret
  await user.save()

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function disableTwoFactor (req: express.Request, res: express.Response) {
  const user = res.locals.user

  user.otpSecret = null
  await user.save()

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}
