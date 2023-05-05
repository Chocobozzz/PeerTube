import express from 'express'
import { Socket } from 'socket.io'
import { getAccessToken } from '@server/lib/auth/oauth-model'
import { RunnerModel } from '@server/models/runner/runner'
import { HttpStatusCode } from '../../shared/models/http/http-error-codes'
import { logger } from '../helpers/logger'
import { handleOAuthAuthenticate } from '../lib/auth/oauth'

function authenticate (req: express.Request, res: express.Response, next: express.NextFunction) {
  handleOAuthAuthenticate(req, res)
    .then((token: any) => {
      res.locals.oauth = { token }
      res.locals.authenticated = true

      return next()
    })
    .catch(err => {
      logger.info('Cannot authenticate.', { err })

      return res.fail({
        status: err.status,
        message: 'Token is invalid',
        type: err.name
      })
    })
}

function authenticateSocket (socket: Socket, next: (err?: any) => void) {
  const accessToken = socket.handshake.query['accessToken']

  logger.debug('Checking access token in runner.')

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

function authenticatePromise (req: express.Request, res: express.Response) {
  return new Promise<void>(resolve => {
    // Already authenticated? (or tried to)
    if (res.locals.oauth?.token.User) return resolve()

    if (res.locals.authenticated === false) {
      return res.fail({
        status: HttpStatusCode.UNAUTHORIZED_401,
        message: 'Not authenticated'
      })
    }

    authenticate(req, res, () => resolve())
  })
}

function optionalAuthenticate (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.header('authorization')) return authenticate(req, res, next)

  res.locals.authenticated = false

  return next()
}

// ---------------------------------------------------------------------------

function authenticateRunnerSocket (socket: Socket, next: (err?: any) => void) {
  const runnerToken = socket.handshake.auth['runnerToken']

  logger.debug('Checking runner token in socket.')

  if (!runnerToken) return next(new Error('No runner token provided'))
  if (typeof runnerToken !== 'string') return next(new Error('Runner token is invalid'))

  RunnerModel.loadByToken(runnerToken)
    .then(runner => {
      if (!runner) return next(new Error('Invalid runner token.'))

      socket.handshake.auth.runner = runner

      return next()
    })
    .catch(err => logger.error('Cannot get runner token.', { err }))
}

// ---------------------------------------------------------------------------

export {
  authenticate,
  authenticateSocket,
  authenticatePromise,
  optionalAuthenticate,
  authenticateRunnerSocket
}
