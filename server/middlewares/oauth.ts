import OAuthServer = require('express-oauth-server')

import { OAUTH_LIFETIME } from '../initializers'
import { logger } from '../helpers'

const oAuthServer = new OAuthServer({
  accessTokenLifetime: OAUTH_LIFETIME.ACCESS_TOKEN,
  refreshTokenLifetime: OAUTH_LIFETIME.REFRESH_TOKEN,
  model: require('../lib/oauth-model')
})

function authenticate (req, res, next) {
  oAuthServer.authenticate()(req, res, function (err) {
    if (err) {
      logger.error('Cannot authenticate.', { error: err })
      return res.sendStatus(500)
    }

    if (res.statusCode === 401 || res.statusCode === 400 || res.statusCode === 503) return res.end()

    return next()
  })
}

function token (req, res, next) {
  return oAuthServer.token()(req, res, next)
}

// ---------------------------------------------------------------------------

export {
  authenticate,
  token
}
