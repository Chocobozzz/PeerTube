import 'express-validator'
import * as express from 'express'
import * as OAuthServer from 'express-oauth-server'
import { logger } from '../helpers/logger'
import { OAUTH_LIFETIME } from '../initializers'

const oAuthServer = new OAuthServer({
  accessTokenLifetime: OAUTH_LIFETIME.ACCESS_TOKEN,
  refreshTokenLifetime: OAUTH_LIFETIME.REFRESH_TOKEN,
  model: require('../lib/oauth-model')
})

function authenticate (req: express.Request, res: express.Response, next: express.NextFunction) {
  oAuthServer.authenticate()(req, res, err => {
    if (err) {
      logger.error('Cannot authenticate.', err)
      return res.sendStatus(500)
    }

    if (res.statusCode === 401 || res.statusCode === 400 || res.statusCode === 503) {
      return res.json({
        error: 'Authentication failed.'
      }).end()
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
