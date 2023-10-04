import express from 'express'
import { HttpStatusCode } from '@peertube/peertube-models'
import { CONFIG } from '../../../initializers/config.js'
import { sendVerifyRegistrationEmail, sendVerifyUserEmail } from '../../../lib/user.js'
import { asyncMiddleware, buildRateLimiter } from '../../../middlewares/index.js'
import {
  registrationVerifyEmailValidator,
  usersAskSendVerifyEmailValidator,
  usersVerifyEmailValidator
} from '../../../middlewares/validators/index.js'

const askSendEmailLimiter = buildRateLimiter({
  windowMs: CONFIG.RATES_LIMIT.ASK_SEND_EMAIL.WINDOW_MS,
  max: CONFIG.RATES_LIMIT.ASK_SEND_EMAIL.MAX
})

const emailVerificationRouter = express.Router()

emailVerificationRouter.post([ '/ask-send-verify-email', '/registrations/ask-send-verify-email' ],
  askSendEmailLimiter,
  asyncMiddleware(usersAskSendVerifyEmailValidator),
  asyncMiddleware(reSendVerifyUserEmail)
)

emailVerificationRouter.post('/:id/verify-email',
  asyncMiddleware(usersVerifyEmailValidator),
  asyncMiddleware(verifyUserEmail)
)

emailVerificationRouter.post('/registrations/:registrationId/verify-email',
  asyncMiddleware(registrationVerifyEmailValidator),
  asyncMiddleware(verifyRegistrationEmail)
)

// ---------------------------------------------------------------------------

export {
  emailVerificationRouter
}

async function reSendVerifyUserEmail (req: express.Request, res: express.Response) {
  const user = res.locals.user
  const registration = res.locals.userRegistration

  if (user) await sendVerifyUserEmail(user)
  else if (registration) await sendVerifyRegistrationEmail(registration)

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function verifyUserEmail (req: express.Request, res: express.Response) {
  const user = res.locals.user
  user.emailVerified = true

  if (req.body.isPendingEmail === true) {
    user.email = user.pendingEmail
    user.pendingEmail = null
  }

  await user.save()

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function verifyRegistrationEmail (req: express.Request, res: express.Response) {
  const registration = res.locals.userRegistration
  registration.emailVerified = true

  await registration.save()

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}
