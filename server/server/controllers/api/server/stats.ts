import express from 'express'
import { StatsManager } from '@server/lib/stat-manager.js'
import { ROUTE_CACHE_LIFETIME } from '../../../initializers/constants.js'
import { asyncMiddleware } from '../../../middlewares/index.js'
import { cacheRoute } from '../../../middlewares/cache/cache.js'
import { Hooks } from '@server/lib/plugins/hooks.js'

const statsRouter = express.Router()

statsRouter.get('/stats',
  cacheRoute(ROUTE_CACHE_LIFETIME.STATS),
  asyncMiddleware(getStats)
)

async function getStats (_req: express.Request, res: express.Response) {
  let data = await StatsManager.Instance.getStats()
  data = await Hooks.wrapObject(data, 'filter:api.server.stats.get.result')

  return res.json(data)
}

// ---------------------------------------------------------------------------

export {
  statsRouter
}
