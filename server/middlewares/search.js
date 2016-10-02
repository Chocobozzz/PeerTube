'use strict'

const searchMiddleware = {
  setVideosSearch
}

function setVideosSearch (req, res, next) {
  if (!req.query.field) req.query.field = 'name'

  return next()
}

// ---------------------------------------------------------------------------

module.exports = searchMiddleware
