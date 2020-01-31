import * as express from 'express'
import { UserRight } from '../../../../shared/models/users'
import { authenticate, ensureUserHasRight } from '../../../middlewares'

const debugRouter = express.Router()

debugRouter.get('/debug',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_DEBUG),
  getDebug
)

// ---------------------------------------------------------------------------

export {
  debugRouter
}

// ---------------------------------------------------------------------------

function getDebug (req: express.Request, res: express.Response) {
  return res.json({
    ip: req.ip
  }).end()
}
