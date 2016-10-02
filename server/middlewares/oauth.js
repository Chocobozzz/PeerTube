'use strict'

const OAuthServer = require('express-oauth-server')

const constants = require('../initializers/constants')
const logger = require('../helpers/logger')

const oAuthServer = new OAuthServer({
  accessTokenLifetime: constants.OAUTH_LIFETIME.ACCESS_TOKEN,
  refreshTokenLifetime: constants.OAUTH_LIFETIME.REFRESH_TOKEN,
  model: require('../lib/oauth-model')
})

const oAuth = {
  authenticate,
  token
}

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

module.exports = oAuth
