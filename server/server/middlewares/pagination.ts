import express from 'express'
import { forceNumber } from '@peertube/peertube-core-utils'
import { PAGINATION } from '../initializers/constants.js'

function setDefaultPagination (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.query.start) req.query.start = 0
  else req.query.start = forceNumber(req.query.start)

  if (!req.query.count) req.query.count = PAGINATION.GLOBAL.COUNT.DEFAULT
  else req.query.count = forceNumber(req.query.count)

  return next()
}

// ---------------------------------------------------------------------------

export {
  setDefaultPagination
}
