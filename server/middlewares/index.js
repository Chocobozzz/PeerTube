'use strict'

const oauth2 = require('./oauth2')
const pagination = require('./pagination')
const reqValidatorsMiddleware = require('./reqValidators')
const search = require('./search')
const sort = require('./sort')
const secureMiddleware = require('./secure')

const middlewares = {
  oauth2: oauth2,
  pagination: pagination,
  reqValidators: reqValidatorsMiddleware,
  search: search,
  sort: sort,
  secure: secureMiddleware
}

// ---------------------------------------------------------------------------

module.exports = middlewares
