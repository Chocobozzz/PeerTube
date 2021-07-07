import * as express from 'express'
import { Socket } from 'socket.io'
import { getAccessToken } from '@server/lib/auth/oauth-model'
import { HttpStatusCode } from '../../shared/core-utils/miscs/http-error-codes'
import { logger } from '../helpers/logger'
import { handleOAuthAuthenticate } from '../lib/auth/oauth'

function authenticate (req: express.Request, res: express.Response, next: express.NextFunction, authenticateInQuery = false) {
  handleOAuthAuthenticate(req, res, authenticateInQuery)
    .then((token: any) => {
      res.locals.oauth = { token }
      res.locals.authenticated = true

      return next()
    })
    .catch(err => {
      logger.warn('Cannot authenticate.', { err })

      return res.fail({
        status: err.status,
        message: 'Token is invalid',
        type: err.name
      })
    })
}

function authenticateSocket (socket: Socket, next: (err?: any) => void) {
  const accessToken = socket.handshake.query['accessToken']

  logger.debug('Checking socket access token %s.', accessToken)

  if (!accessToken) return next(new Error('No access token provided'))
  if (typeof accessToken !== 'string') return next(new Error('Access token is invalid'))

  getAccessToken(accessToken)
    .then(tokenDB => {
      const now = new Date()

      if (!tokenDB || tokenDB.accessTokenExpiresAt < now || tokenDB.refreshTokenExpiresAt < now) {
        return next(new Error('Invalid access token.'))
      }

      socket.handshake.auth.user = tokenDB.User

      return next()
    })
    .catch(err => logger.error('Cannot get access token.', { err }))
}

function authenticatePromiseIfNeeded (req: express.Request, res: express.Response, authenticateInQuery = false) {
  return new Promise<void>(resolve => {
    // Already authenticated? (or tried to)
    if (res.locals.oauth?.token.User) return resolve()

    if (res.locals.authenticated === false) {
      return res.fail({
        status: HttpStatusCode.UNAUTHORIZED_401,
        message: 'Not authenticated'
      })
    }

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
