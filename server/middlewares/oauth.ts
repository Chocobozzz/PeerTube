import * as express from 'express'
import * as OAuthServer from 'express-oauth-server'
import { OAUTH_LIFETIME } from '../initializers/constants'
import { logger } from '../helpers/logger'
import { Socket } from 'socket.io'
import { getAccessToken } from '../lib/oauth-model'

const oAuthServer = new OAuthServer({
  useErrorHandler: true,
  accessTokenLifetime: OAUTH_LIFETIME.ACCESS_TOKEN,
  refreshTokenLifetime: OAUTH_LIFETIME.REFRESH_TOKEN,
  continueMiddleware: true,
  model: require('../lib/oauth-model')
})

function authenticate (req: express.Request, res: express.Response, next: express.NextFunction, authenticateInQuery = false) {
  const options = authenticateInQuery ? { allowBearerTokensInQueryString: true } : {}

  oAuthServer.authenticate(options)(req, res, err => {
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

function authenticateSocket (socket: Socket, next: (err?: any) => void) {
  const accessToken = socket.handshake.query.accessToken

  logger.debug('Checking socket access token %s.', accessToken)

  if (!accessToken) return next(new Error('No access token provided'))

  getAccessToken(accessToken)
    .then(tokenDB => {
      const now = new Date()

      if (!tokenDB || tokenDB.accessTokenExpiresAt < now || tokenDB.refreshTokenExpiresAt < now) {
        return next(new Error('Invalid access token.'))
      }

      socket.handshake.query.user = tokenDB.User

      return next()
    })
    .catch(err => logger.error('Cannot get access token.', { err }))
}

function authenticatePromiseIfNeeded (req: express.Request, res: express.Response, authenticateInQuery = false) {
  return new Promise(resolve => {
    // Already authenticated? (or tried to)
    if (res.locals.oauth && res.locals.oauth.token.User) return resolve()

    if (res.locals.authenticated === false) return res.sendStatus(401)

    authenticate(req, res, () => resolve(), authenticateInQuery)
  })
}

function optionalAuthenticate (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.header('authorization')) return authenticate(req, res, next)

  res.locals.authenticated = false

  return next()
}

function token (req: express.Request, res: express.Response, next: express.NextFunction) {
  return oAuthServer.token()(req, res, err => {
    if (err) {
      return res.status(err.status)
        .json({
          error: err.message,
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
  authenticateSocket,
  authenticatePromiseIfNeeded,
  optionalAuthenticate,
  token
}
