import 'express-validator'
import * as express from 'express'

import { logger } from '../helpers'

function ensureIsAdmin (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.oauth.token.user
  if (user.isAdmin() === false) {
    logger.info('A non admin user is trying to access to an admin content.')
    return res.sendStatus(403)
  }

  return next()
}

// ---------------------------------------------------------------------------

export {
  ensureIsAdmin
}
