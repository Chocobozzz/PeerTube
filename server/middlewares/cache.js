'use strict'

const cacheMiddleware = {
  cache: cache
}

function cache (cache) {
  return function (req, res, next) {
    // If we want explicitly a cache
    // Or if we don't specify if we want a cache or no and we are in production
    if (cache === true || (cache !== false && process.env.NODE_ENV === 'production')) {
      res.setHeader('Cache-Control', 'public')
    } else {
      res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate')
    }

    next()
  }
}

// ---------------------------------------------------------------------------

module.exports = cacheMiddleware
