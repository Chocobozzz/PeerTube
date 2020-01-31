import * as express from 'express'
import { SortType } from '../models/utils'

const setDefaultSort = setDefaultSortFactory('-createdAt')

const setDefaultVideoRedundanciesSort = setDefaultSortFactory('name')

const setDefaultSearchSort = setDefaultSortFactory('-match')

function setBlacklistSort (req: express.Request, res: express.Response, next: express.NextFunction) {
  const newSort: SortType = { sortModel: undefined, sortValue: '' }

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
  setDefaultSort,
  setDefaultSearchSort,
  setDefaultVideoRedundanciesSort,
  setBlacklistSort
}

// ---------------------------------------------------------------------------

function setDefaultSortFactory (sort: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.query.sort) req.query.sort = sort

    return next()
  }
}
