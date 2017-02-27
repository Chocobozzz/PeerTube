'use strict'

const express = require('express')
const parallel = require('async/parallel')

const constants = require('../../initializers/constants')
const friends = require('../../lib/friends')
const middlewares = require('../../middlewares')
const admin = middlewares.admin
const oAuth = middlewares.oauth

const router = express.Router()

router.get('/stats',
  oAuth.authenticate,
  admin.ensureIsAdmin,
  getStatsRequests
)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function getStatsRequests (req, res, next) {
  parallel({
    requestScheduler: buildRequestSchedulerFunction(friends.getRequestScheduler()),
    requestVideoQaduScheduler: buildRequestSchedulerFunction(friends.getRequestVideoQaduScheduler()),
    requestVideoEventScheduler: buildRequestSchedulerFunction(friends.getRequestVideoEventScheduler())
  }, function (err, result) {
    if (err) return next(err)

    return res.json(result)
  })
}

// ---------------------------------------------------------------------------

function buildRequestSchedulerFunction (requestScheduler) {
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
