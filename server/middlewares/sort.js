'use strict'

const sortMiddleware = {
  setUsersSort: setUsersSort,
  setVideosSort: setVideosSort
}

function setUsersSort (req, res, next) {
  if (!req.query.sort) req.query.sort = '-createdDate'

  return next()
}

function setVideosSort (req, res, next) {
  if (!req.query.sort) req.query.sort = '-createdDate'

  return next()
}

// ---------------------------------------------------------------------------

module.exports = sortMiddleware
