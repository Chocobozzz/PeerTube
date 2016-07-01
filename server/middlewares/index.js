'use strict'

const oauth = require('./oauth')
const pagination = require('./pagination')
const reqValidatorsMiddleware = require('./reqValidators')
const search = require('./search')
const sort = require('./sort')
const secureMiddleware = require('./secure')

const middlewares = {
  oauth: oauth,
  pagination: pagination,
  reqValidators: reqValidatorsMiddleware,
  search: search,
  sort: sort,
  secure: secureMiddleware
}

// ---------------------------------------------------------------------------

module.exports = middlewares
