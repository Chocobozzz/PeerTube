import * as express from 'express'
import { StatsManager } from '@server/lib/stat-manager'
import { ROUTE_CACHE_LIFETIME } from '../../../initializers/constants'
import { asyncMiddleware } from '../../../middlewares'
import { cacheRoute } from '../../../middlewares/cache'

const statsRouter = express.Router()

statsRouter.get('/stats',
  asyncMiddleware(cacheRoute()(ROUTE_CACHE_LIFETIME.STATS)),
  asyncMiddleware(getStats)
)

async function getStats (_req: express.Request, res: express.Response) {
  const data = await StatsManager.Instance.getStats()

  return res.json(data)
}

// ---------------------------------------------------------------------------

export {
  statsRouter
}
