import * as express from 'express'
import * as Bluebird from 'bluebird'

import {
  AbstractRequestScheduler,
  getRequestScheduler,
  getRequestVideoQaduScheduler,
  getRequestVideoEventScheduler
} from '../../lib'
import { authenticate, ensureIsAdmin, asyncMiddleware } from '../../middlewares'
import { RequestSchedulerStatsAttributes } from '../../../shared'

const requestSchedulerRouter = express.Router()

requestSchedulerRouter.get('/stats',
  authenticate,
  ensureIsAdmin,
  asyncMiddleware(getRequestSchedulersStats)
)

// ---------------------------------------------------------------------------

export {
  requestSchedulerRouter
}

// ---------------------------------------------------------------------------

async function getRequestSchedulersStats (req: express.Request, res: express.Response, next: express.NextFunction) {
  const result = await Bluebird.props({
    requestScheduler: buildRequestSchedulerStats(getRequestScheduler()),
    requestVideoQaduScheduler: buildRequestSchedulerStats(getRequestVideoQaduScheduler()),
    requestVideoEventScheduler: buildRequestSchedulerStats(getRequestVideoEventScheduler())
  })

  return res.json(result)
}

// ---------------------------------------------------------------------------

async function buildRequestSchedulerStats (requestScheduler: AbstractRequestScheduler<any>) {
  const count = await requestScheduler.remainingRequestsCount()

  const result: RequestSchedulerStatsAttributes = {
    totalRequests: count,
    requestsLimitPods: requestScheduler.limitPods,
    requestsLimitPerPod: requestScheduler.limitPerPod,
    remainingMilliSeconds: requestScheduler.remainingMilliSeconds(),
    milliSecondsInterval: requestScheduler.requestInterval
  }

  return result
}
