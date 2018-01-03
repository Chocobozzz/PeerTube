import * as express from 'express'
import 'express-validator'
import { SortType } from '../helpers/utils'

function setAccountsSort (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.query.sort) req.query.sort = '-createdAt'

  return next()
}

function setUsersSort (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.query.sort) req.query.sort = '-createdAt'

  return next()
}

function setJobsSort (req: express.Request, res: express.Response, next: express.NextFunction) {
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

function setVideoCommentThreadsSort (req: express.Request, res: express.Response, next: express.NextFunction) {
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
    newSort.sortModel = 'Video'
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
  setFollowingSort,
  setJobsSort,
  setVideoCommentThreadsSort,
  setAccountsSort
}
