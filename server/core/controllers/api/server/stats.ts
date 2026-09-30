import { Hooks } from '@server/lib/plugins/hooks.js'
import { StatsManager } from '@server/lib/stat-manager.js'
import express from 'express'
import { ROUTE_CACHE_LIFETIME } from '../../../initializers/constants.js'
import { cacheRoute } from '../../../middlewares/cache/cache.js'
import { asyncMiddleware, primaryOnly } from '../../../middlewares/index.js'

const statsRouter = express.Router()

statsRouter.get(
  '/stats',
  primaryOnly, // ActivityPub inbox stats are kept in the memory of the primary, that processes the inbox
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
