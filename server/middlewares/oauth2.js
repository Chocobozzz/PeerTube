'use strict'

const OAuthServer = require('express-oauth-server')

const logger = require('../helpers/logger')

const oAuthServer = new OAuthServer({
  model: require('../models/users')
})

const oAuth2 = {
  authenticate: authenticate,
  token: token
}

function authenticate (req, res, next) {
  oAuthServer.authenticate()(req, res, function (err) {
    if (err) {
      logger.error('Cannot authenticate.', { error: err })
      return res.sendStatus(500)
    }

    if (res.statusCode === 401 || res.statusCode === 400) return res.end()

    return next()
  })
}

function token (req, res, next) {
  return oAuthServer.token()(req, res, next)
}

// ---------------------------------------------------------------------------

module.exports = oAuth2
