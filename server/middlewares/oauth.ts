import * as express from 'express'
import * as OAuthServer from 'express-oauth-server'
import 'express-validator'
import { OAUTH_LIFETIME } from '../initializers'

const oAuthServer = new OAuthServer({
  useErrorHandler: true,
  accessTokenLifetime: OAUTH_LIFETIME.ACCESS_TOKEN,
  refreshTokenLifetime: OAUTH_LIFETIME.REFRESH_TOKEN,
  model: require('../lib/oauth-model')
})

function authenticate (req: express.Request, res: express.Response, next: express.NextFunction) {
  oAuthServer.authenticate()(req, res, err => {
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

function token (req: express.Request, res: express.Response, next: express.NextFunction) {
  return oAuthServer.token()(req, res, next)
}

// ---------------------------------------------------------------------------

export {
  authenticate,
  token
}
