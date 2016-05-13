'use strict'

const reqValidatorsMiddleware = require('./reqValidators')
const secureMiddleware = require('./secure')

const middlewares = {
  reqValidators: reqValidatorsMiddleware,
  secure: secureMiddleware
}

// ---------------------------------------------------------------------------

module.exports = middlewares
