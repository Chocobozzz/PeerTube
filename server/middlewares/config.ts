import 'express-validator'
import * as express from 'express'

import { CONFIG } from '../initializers'

function ensureUserRegistrationEnabled (req: express.Request, res: express.Response, next: express.NextFunction) {
  const registrationEnabled = CONFIG.SIGNUP.ENABLED

  if (registrationEnabled === true) {
    return next()
  }

  return res.status(400).send('User registration is not enabled.')
}

// ---------------------------------------------------------------------------

export {
  ensureUserRegistrationEnabled
}
