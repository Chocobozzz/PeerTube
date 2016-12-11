'use strict'

const sortMiddleware = {
  setUsersSort,
  setVideosSort
}

function setUsersSort (req, res, next) {
  if (!req.query.sort) req.query.sort = '-createdAt'

  return next()
}

function setVideosSort (req, res, next) {
  if (!req.query.sort) req.query.sort = '-createdAt'

  return next()
}

// ---------------------------------------------------------------------------

module.exports = sortMiddleware
