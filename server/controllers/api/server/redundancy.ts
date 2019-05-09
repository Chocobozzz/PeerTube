import * as express from 'express'
import { UserRight } from '../../../../shared/models/users'
import { asyncMiddleware, authenticate, ensureUserHasRight } from '../../../middlewares'
import { updateServerRedundancyValidator } from '../../../middlewares/validators/redundancy'
import { removeRedundancyOf } from '../../../lib/redundancy'
import { logger } from '../../../helpers/logger'

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

async function updateRedundancy (req: express.Request, res: express.Response) {
  const server = res.locals.server

  server.redundancyAllowed = req.body.redundancyAllowed

  await server.save()

  // Async, could be long
  removeRedundancyOf(server.id)
    .catch(err => logger.error('Cannot remove redundancy of %s.', server.host, err))

  return res.sendStatus(204)
}
