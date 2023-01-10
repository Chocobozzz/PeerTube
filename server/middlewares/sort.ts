import express from 'express'

const setDefaultSort = setDefaultSortFactory('-createdAt')
const setDefaultVideosSort = setDefaultSortFactory('-publishedAt')

const setDefaultVideoRedundanciesSort = setDefaultSortFactory('name')

const setDefaultSearchSort = setDefaultSortFactory('-match')
const setBlacklistSort = setDefaultSortFactory('-createdAt')

// ---------------------------------------------------------------------------

export {
  setDefaultSort,
  setDefaultSearchSort,
  setDefaultVideosSort,
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
