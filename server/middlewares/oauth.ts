import * as express from 'express'
import * as OAuthServer from 'express-oauth-server'
import 'express-validator'
import { OAUTH_LIFETIME } from '../initializers'
import { logger } from '../helpers/logger'

const oAuthServer = new OAuthServer({
  useErrorHandler: true,
  accessTokenLifetime: OAUTH_LIFETIME.ACCESS_TOKEN,
  refreshTokenLifetime: OAUTH_LIFETIME.REFRESH_TOKEN,
  model: require('../lib/oauth-model')
})

function authenticate (req: express.Request, res: express.Response, next: express.NextFunction) {
  oAuthServer.authenticate()(req, res, err => {
    if (err) {
      logger.warn('Cannot authenticate.', { err })

      return res.status(err.status)
        .json({
          error: 'Token is invalid.',
          code: err.name
        })
        .end()
    }

    return next()
  })
}

function optionalAuthenticate (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.header('authorization')) return authenticate(req, res, next)

  return next()
}

function token (req: express.Request, res: express.Response, next: express.NextFunction) {
  return oAuthServer.token()(req, res, err => {
    if (err) {
      return res.status(err.status)
        .json({
          error: 'Authentication failed.',
          code: err.name
        })
        .end()
    }

    return next()
  })
}

// ---------------------------------------------------------------------------

export {
  authenticate,
  optionalAuthenticate,
  token
}
