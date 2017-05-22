import { PAGINATION_COUNT_DEFAULT } from '../initializers'

function setPagination (req, res, next) {
  if (!req.query.start) req.query.start = 0
  else req.query.start = parseInt(req.query.start, 10)

  if (!req.query.count) req.query.count = PAGINATION_COUNT_DEFAULT
  else req.query.count = parseInt(req.query.count, 10)

  return next()
}

// ---------------------------------------------------------------------------

export {
  setPagination
}
