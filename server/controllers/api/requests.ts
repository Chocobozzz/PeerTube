import * as express from 'express'
import { parallel } from 'async'

import {
  BaseRequestScheduler,
  getRequestScheduler,
  getRequestVideoQaduScheduler,
  getRequestVideoEventScheduler
} from '../../lib'
import { authenticate, ensureIsAdmin } from '../../middlewares'

const requestsRouter = express.Router()

requestsRouter.get('/stats',
  authenticate,
  ensureIsAdmin,
  getStatsRequests
)

// ---------------------------------------------------------------------------

export {
  requestsRouter
}

// ---------------------------------------------------------------------------

function getStatsRequests (req: express.Request, res: express.Response, next: express.NextFunction) {
  parallel({
    requestScheduler: buildRequestSchedulerFunction(getRequestScheduler()),
    requestVideoQaduScheduler: buildRequestSchedulerFunction(getRequestVideoQaduScheduler()),
    requestVideoEventScheduler: buildRequestSchedulerFunction(getRequestVideoEventScheduler())
  }, function (err, result) {
    if (err) return next(err)

    return res.json(result)
  })
}

// ---------------------------------------------------------------------------

function buildRequestSchedulerFunction (requestScheduler: BaseRequestScheduler) {
  return function (callback) {
    requestScheduler.remainingRequestsCount(function (err, count) {
      if (err) return callback(err)

      const result = {
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
