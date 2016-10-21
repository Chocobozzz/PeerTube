'use strict'

const express = require('express')
const mongoose = require('mongoose')

const constants = require('../../initializers/constants')
const middlewares = require('../../middlewares')
const admin = middlewares.admin
const oAuth = middlewares.oauth

const Request = mongoose.model('Request')

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
  Request.list(function (err, requests) {
    if (err) return next(err)

    return res.json({
      requests: requests,
      maxRequestsInParallel: constants.REQUESTS_IN_PARALLEL,
      remainingMilliSeconds: Request.remainingMilliSeconds(),
      milliSecondsInterval: constants.REQUESTS_INTERVAL
    })
  })
}
