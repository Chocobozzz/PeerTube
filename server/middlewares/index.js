'use strict'

const oauth = require('./oauth')
const pagination = require('./pagination')
const validatorsMiddleware = require('./validators')
const search = require('./search')
const sort = require('./sort')
const secureMiddleware = require('./secure')

const middlewares = {
  oauth: oauth,
  pagination: pagination,
  validators: validatorsMiddleware,
  search: search,
  sort: sort,
  secure: secureMiddleware
}

// ---------------------------------------------------------------------------

module.exports = middlewares
