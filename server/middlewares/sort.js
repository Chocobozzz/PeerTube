'use strict'

const sortMiddleware = {
  setVideosSort: setVideosSort
}

function setVideosSort (req, res, next) {
  if (!req.query.sort) req.query.sort = '-createdDate'

  return next()
}

// ---------------------------------------------------------------------------

module.exports = sortMiddleware
