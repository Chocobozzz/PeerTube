'use strict'

const oauth2 = require('./oauth2')
const pagination = require('./pagination')
const reqValidatorsMiddleware = require('./reqValidators')
const secureMiddleware = require('./secure')

const middlewares = {
  oauth2: oauth2,
  pagination: pagination,
  reqValidators: reqValidatorsMiddleware,
  secure: secureMiddleware
}

// ---------------------------------------------------------------------------

module.exports = middlewares
