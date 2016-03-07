'use strict'

var cacheMiddleware = require('./cache')
var reqValidatorsMiddleware = require('./reqValidators')
var secureMiddleware = require('./secure')

var middlewares = {
  cache: cacheMiddleware,
  reqValidators: reqValidatorsMiddleware,
  secure: secureMiddleware
}

// ---------------------------------------------------------------------------

module.exports = middlewares
