import * as express from 'express'
import * as Promise from 'bluebird'

import {
  AbstractRequestScheduler,
  getRequestScheduler,
  getRequestVideoQaduScheduler,
  getRequestVideoEventScheduler
} from '../../lib'
import { authenticate, ensureIsAdmin } from '../../middlewares'
import { RequestSchedulerStatsAttributes } from '../../../shared'

const requestSchedulerRouter = express.Router()

requestSchedulerRouter.get('/stats',
  authenticate,
  ensureIsAdmin,
  getRequestSchedulersStats
)

// ---------------------------------------------------------------------------

export {
  requestSchedulerRouter
}

// ---------------------------------------------------------------------------

function getRequestSchedulersStats (req: express.Request, res: express.Response, next: express.NextFunction) {
  Promise.props({
    requestScheduler: buildRequestSchedulerStats(getRequestScheduler()),
    requestVideoQaduScheduler: buildRequestSchedulerStats(getRequestVideoQaduScheduler()),
    requestVideoEventScheduler: buildRequestSchedulerStats(getRequestVideoEventScheduler())
  })
  .then(result => res.json(result))
  .catch(err => next(err))
}

// ---------------------------------------------------------------------------

function buildRequestSchedulerStats (requestScheduler: AbstractRequestScheduler<any>) {
  return requestScheduler.remainingRequestsCount().then(count => {
    const result: RequestSchedulerStatsAttributes = {
      totalRequests: count,
      requestsLimitPods: requestScheduler.limitPods,
      requestsLimitPerPod: requestScheduler.limitPerPod,
      remainingMilliSeconds: requestScheduler.remainingMilliSeconds(),
      milliSecondsInterval: requestScheduler.requestInterval
    }

    return result
  })
}
