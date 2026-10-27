import express from 'express'
import { auditLog, buildUserAuditEntity, getAuditActorFromRes } from '@server/lib/audit-log/index.js'
import { generateOTPSecret, isOTPValid } from '@server/helpers/otp.js'
import { encrypt } from '@server/helpers/peertube-crypto.js'
import { CONFIG } from '@server/initializers/config.js'
import { Redis } from '@server/lib/redis/index.js'
import {
  asyncMiddleware,
  authenticate,
  buildRateLimiter,
  confirmTokenRateLimiter,
  usersCheckCurrentPasswordFactory
} from '@server/middlewares/index.js'
import {
  confirmTwoFactorValidator,
  disableTwoFactorValidator,
  requestOrConfirmTwoFactorValidator
} from '@server/middlewares/validators/two-factor.js'
import { HttpStatusCode } from '@peertube/peertube-models'

const twoFactorRouter = express.Router()

// Checking the current password is a login attempt
const currentPasswordRateLimiter = buildRateLimiter({
  enabled: CONFIG.RATES_LIMIT.LOGIN.ENABLED,
  name: 'two-factor-current-password',
  windowMs: CONFIG.RATES_LIMIT.LOGIN.WINDOW_MS,
  max: CONFIG.RATES_LIMIT.LOGIN.MAX,
  perUserKey: true,
  failOnUnavailableRedis: true
})

twoFactorRouter.post(
  '/:id/two-factor/request',
  authenticate,
  currentPasswordRateLimiter,
  asyncMiddleware(usersCheckCurrentPasswordFactory(req => req.params.id)),
  asyncMiddleware(requestOrConfirmTwoFactorValidator),
  asyncMiddleware(requestTwoFactor)
)

twoFactorRouter.post(
  '/:id/two-factor/confirm-request',
  confirmTokenRateLimiter,
  authenticate,
  asyncMiddleware(requestOrConfirmTwoFactorValidator),
  confirmTwoFactorValidator,
  asyncMiddleware(confirmRequestTwoFactor)
)

twoFactorRouter.post(
  '/:id/two-factor/disable',
  authenticate,
  currentPasswordRateLimiter,
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
  })
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

  const oldUserAuditEntity = auditLog.snapshot(() => buildUserAuditEntity(user))

  user.otpSecret = encryptedSecret
  await user.save()

  auditLog.update(getAuditActorFromRes(res), () => buildUserAuditEntity(user), oldUserAuditEntity)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function disableTwoFactor (req: express.Request, res: express.Response) {
  const user = res.locals.user

  const oldUserAuditEntity = auditLog.snapshot(() => buildUserAuditEntity(user))

  user.otpSecret = null
  await user.save()

  auditLog.update(getAuditActorFromRes(res), () => buildUserAuditEntity(user), oldUserAuditEntity)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}
