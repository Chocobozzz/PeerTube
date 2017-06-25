import * as express from 'express'
import { parallel } from 'async'

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
  parallel({
    requestScheduler: buildRequestSchedulerStats(getRequestScheduler()),
    requestVideoQaduScheduler: buildRequestSchedulerStats(getRequestVideoQaduScheduler()),
    requestVideoEventScheduler: buildRequestSchedulerStats(getRequestVideoEventScheduler())
  }, function (err, result) {
    if (err) return next(err)

    return res.json(result)
  })
}

// ---------------------------------------------------------------------------

function buildRequestSchedulerStats (requestScheduler: AbstractRequestScheduler) {
  return function (callback) {
    requestScheduler.remainingRequestsCount(function (err, count) {
      if (err) return callback(err)

      const result: RequestSchedulerStatsAttributes = {
        totalRequests: count,
        requestsLimitPods: requestScheduler.limitPods,
        requestsLimitPerPod: requestScheduler.limitPerPod,
        remainingMilliSeconds: requestScheduler.remainingMilliSeconds(),
        milliSecondsInterval: requestScheduler.requestInterval
      }

      return callback(null, result)
    })
  }
}
