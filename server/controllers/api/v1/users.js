'use strict'

var express = require('express')
var oAuth2 = require('../../../middlewares/oauth2')

const middleware = require('../../../middlewares')
const cacheMiddleware = middleware.cache

const router = express.Router()

router.post('/token', cacheMiddleware.cache(false), oAuth2.token(), success)
router.get('/authenticate', cacheMiddleware.cache(false), oAuth2.authenticate(), success)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function success (req, res, next) {
  res.end()
}
