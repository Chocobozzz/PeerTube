'use strict'

const express = require('express')
const oAuth2 = require('../../../middlewares/oauth2')

const middleware = require('../../../middlewares')
const cacheMiddleware = middleware.cache

const router = express.Router()

router.post('/token', cacheMiddleware.cache(false), oAuth2.token, success)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function success (req, res, next) {
  res.end()
}
