import * as express from 'express'
import { UserRight } from '../../../../shared/models/users'
import { asyncMiddleware, authenticate, ensureUserHasRight } from '../../../middlewares'
import { updateServerRedundancyValidator } from '../../../middlewares/validators/redundancy'
import { ServerModel } from '../../../models/server/server'

const serverRedundancyRouter = express.Router()

serverRedundancyRouter.put('/redundancy/:host',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVER_FOLLOW),
  asyncMiddleware(updateServerRedundancyValidator),
  asyncMiddleware(updateRedundancy)
)

// ---------------------------------------------------------------------------

export {
  serverRedundancyRouter
}

// ---------------------------------------------------------------------------

async function updateRedundancy (req: express.Request, res: express.Response, next: express.NextFunction) {
  const server = res.locals.server as ServerModel

  server.redundancyAllowed = req.body.redundancyAllowed

  await server.save()

  return res.sendStatus(204)
}
