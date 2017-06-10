import 'express-validator'
import * as express from 'express'

function setVideosSearch (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.query.field) req.query.field = 'name'

  return next()
}

// ---------------------------------------------------------------------------

export {
  setVideosSearch
}
