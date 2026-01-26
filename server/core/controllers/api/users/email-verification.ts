import { HttpStatusCode } from '@peertube/peertube-models'
import express from 'express'
import { CONFIG } from '../../../initializers/config.js'
import { sendVerifyRegistrationEmail, sendVerifyRegistrationRequestEmail, sendVerifyUserChangeEmail } from '../../../lib/user.js'
import { asyncMiddleware, buildRateLimiter } from '../../../middlewares/index.js'
import {
  registrationVerifyEmailValidator,
  usersAskSendRegistrationVerifyEmailValidator,
  usersAskSendUserVerifyEmailValidator,
  usersVerifyEmailValidator
} from '../../../middlewares/validators/index.js'

const askSendEmailLimiter = buildRateLimiter({
  windowMs: CONFIG.RATES_LIMIT.ASK_SEND_EMAIL.WINDOW_MS,
  max: CONFIG.RATES_LIMIT.ASK_SEND_EMAIL.MAX
})

const emailVerificationRouter = express.Router()

emailVerificationRouter.post(
  '/ask-send-verify-email',
  askSendEmailLimiter,
  asyncMiddleware(usersAskSendUserVerifyEmailValidator),
  asyncMiddleware(reSendUserVerifyUserEmail)
)

emailVerificationRouter.post(
  '/registrations/ask-send-verify-email',
  askSendEmailLimiter,
  asyncMiddleware(usersAskSendRegistrationVerifyEmailValidator),
  asyncMiddleware(reSendRegistrationVerifyUserEmail)
)

emailVerificationRouter.post('/:id/verify-email', asyncMiddleware(usersVerifyEmailValidator), asyncMiddleware(verifyUserEmail))

emailVerificationRouter.post(
  '/registrations/:registrationId/verify-email',
  asyncMiddleware(registrationVerifyEmailValidator),
  asyncMiddleware(verifyRegistrationEmail)
)

// ---------------------------------------------------------------------------

export {
  emailVerificationRouter
}

async function reSendUserVerifyUserEmail (req: express.Request, res: express.Response) {
  if (res.locals.userPendingEmail) { // User wants to change its current email
    await sendVerifyUserChangeEmail(res.locals.userPendingEmail)
  } else { // After an account creation
    await sendVerifyRegistrationEmail(res.locals.userEmail)
  }

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function reSendRegistrationVerifyUserEmail (req: express.Request, res: express.Response) {
  await sendVerifyRegistrationRequestEmail(res.locals.userRegistration)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function verifyUserEmail (req: express.Request, res: express.Response) {
  const user = res.locals.user
  user.emailVerified = true

  if (req.body.isPendingEmail === true) {
    user.email = user.pendingEmail
    user.pendingEmail = null
  }

  await user.save()

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function verifyRegistrationEmail (req: express.Request, res: express.Response) {
  const registration = res.locals.userRegistration
  registration.emailVerified = true

  await registration.save()

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}
