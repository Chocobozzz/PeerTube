import * as express from 'express'
import { UserRight } from '../../../../shared/models/users'
import { asyncMiddleware, authenticate, ensureUserHasRight } from '../../../middlewares'

const debugRouter = express.Router()

debugRouter.get('/debug',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_DEBUG),
  asyncMiddleware(getDebug)
)

// ---------------------------------------------------------------------------

export {
  debugRouter
}

// ---------------------------------------------------------------------------

async function getDebug (req: express.Request, res: express.Response) {
  return res.json({
    ip: req.ip
  }).end()
}
