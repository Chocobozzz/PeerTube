import 'express-validator'
import * as express from 'express'

import { PAGINATION_COUNT_DEFAULT } from '../initializers'

function setPagination (req: express.Request, res: express.Response, next: express.NextFunction) {
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
