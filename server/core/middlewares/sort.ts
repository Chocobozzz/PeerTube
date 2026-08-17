import express from 'express'

export const setDefaultSort = setDefaultSortFactory('-createdAt')
export const setDefaultVideosSort = setDefaultSortFactory('-publishedAt')

export const setDefaultVideoRedundanciesSort = setDefaultSortFactory('name')

export const setDefaultSearchSort = setDefaultSortFactory('-match')
export const setBlacklistSort = setDefaultSortFactory('-createdAt')

// Replies are unfolded on top of a thread tree, which is always built in chronological order
export const setDefaultCommentRepliesSort = setDefaultSortFactory('createdAt')

export const setLiveSessionsSort = setDefaultSortFactory('startDate')

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function setDefaultSortFactory (sort: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.query.sort) req.query.sort = sort

    return next()
  }
}
