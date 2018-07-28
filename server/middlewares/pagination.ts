import 'express-validator'
import * as express from 'express'

import { PAGINATION } from '../initializers'

function setDefaultPagination (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.query.start) req.query.start = 0
  else req.query.start = parseInt(req.query.start, 10)

  if (!req.query.count) req.query.count = PAGINATION.COUNT.DEFAULT
  else req.query.count = parseInt(req.query.count, 10)

  if (req.query.count > PAGINATION.COUNT.MAX) req.query.count = PAGINATION.COUNT.MAX

  return next()
}

// ---------------------------------------------------------------------------

export {
  setDefaultPagination
}
