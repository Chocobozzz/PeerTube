import * as express from 'express'
import { Socket } from 'socket.io'
import { oAuthServer } from '@server/lib/auth'
import { logger } from '../helpers/logger'
import { getAccessToken } from '../lib/oauth-model'
import { HttpStatusCode } from '../../shared/core-utils/miscs/http-error-codes'

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

    res.locals.authenticated = true

    return next()
  })
}

function authenticateSocket (socket: Socket, next: (err?: any) => void) {
  const accessToken = socket.handshake.query['accessToken']

  logger.debug('Checking socket access token %s.', accessToken)

  if (!accessToken) return next(new Error('No access token provided'))

  getAccessToken(accessToken)
    .then(tokenDB => {
      const now = new Date()

      if (!tokenDB || tokenDB.accessTokenExpiresAt < now || tokenDB.refreshTokenExpiresAt < now) {
        return next(new Error('Invalid access token.'))
      }

      socket.handshake.query['user'] = tokenDB.User

      return next()
    })
    .catch(err => logger.error('Cannot get access token.', { err }))
}

function authenticatePromiseIfNeeded (req: express.Request, res: express.Response, authenticateInQuery = false) {
  return new Promise<void>(resolve => {
    // Already authenticated? (or tried to)
    if (res.locals.oauth?.token.User) return resolve()

    if (res.locals.authenticated === false) return res.sendStatus(HttpStatusCode.UNAUTHORIZED_401)

    authenticate(req, res, () => resolve(), authenticateInQuery)
  })
}

function optionalAuthenticate (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.header('authorization')) return authenticate(req, res, next)

  res.locals.authenticated = false

  return next()
}

// ---------------------------------------------------------------------------

export {
  authenticate,
  authenticateSocket,
  authenticatePromiseIfNeeded,
  optionalAuthenticate
}
