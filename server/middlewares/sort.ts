import 'express-validator'
import * as express from 'express'

function setUsersSort (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.query.sort) req.query.sort = '-createdAt'

  return next()
}

function setVideoAbusesSort (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.query.sort) req.query.sort = '-createdAt'

  return next()
}

function setVideosSort (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.query.sort) req.query.sort = '-createdAt'

  return next()
}

// ---------------------------------------------------------------------------

export {
  setUsersSort,
  setVideoAbusesSort,
  setVideosSort
}
