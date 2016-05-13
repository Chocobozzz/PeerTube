'use strict'

const paginationMiddleware = {
  setPagination: setPagination
}

function setPagination (req, res, next) {
  if (!req.query.start) req.query.start = 0
  else req.query.start = parseInt(req.query.start)
  if (!req.query.count) req.query.count = 15
  else req.query.count = parseInt(req.query.count)

  return next()
}

// ---------------------------------------------------------------------------

module.exports = paginationMiddleware
