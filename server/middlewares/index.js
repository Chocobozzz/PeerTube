'use strict'

const cacheMiddleware = require('./cache')
const reqValidatorsMiddleware = require('./reqValidators')
const secureMiddleware = require('./secure')

const middlewares = {
  cache: cacheMiddleware,
  reqValidators: reqValidatorsMiddleware,
  secure: secureMiddleware
}

// ---------------------------------------------------------------------------

module.exports = middlewares
