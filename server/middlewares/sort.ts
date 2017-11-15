import 'express-validator'
import * as express from 'express'

import { SortType } from '../helpers'
import { database } from '../initializers'

function setUsersSort (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.query.sort) req.query.sort = '-createdAt'

  return next()
}

function setVideoAbusesSort (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.query.sort) req.query.sort = '-createdAt'

  return next()
}

function setVideoChannelsSort (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.query.sort) req.query.sort = '-createdAt'

  return next()
}

function setVideosSort (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.query.sort) req.query.sort = '-createdAt'

  return next()
}

function setFollowersSort (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.query.sort) req.query.sort = '-createdAt'

  return next()
}

function setFollowingSort (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.query.sort) req.query.sort = '-createdAt'

  return next()
}

function setBlacklistSort (req: express.Request, res: express.Response, next: express.NextFunction) {
  let newSort: SortType = { sortModel: undefined, sortValue: undefined }

  if (!req.query.sort) req.query.sort = '-createdAt'

  // Set model we want to sort onto
  if (req.query.sort === '-createdAt' || req.query.sort === 'createdAt' ||
      req.query.sort === '-id' || req.query.sort === 'id') {
    // If we want to sort onto the BlacklistedVideos relation, we won't specify it in the query parameter ...
    newSort.sortModel = undefined
  } else {
    newSort.sortModel = database.Video
  }

  newSort.sortValue = req.query.sort

  req.query.sort = newSort

  return next()
}

// ---------------------------------------------------------------------------

export {
  setUsersSort,
  setVideoAbusesSort,
  setVideoChannelsSort,
  setVideosSort,
  setBlacklistSort,
  setFollowersSort,
  setFollowingSort
}
