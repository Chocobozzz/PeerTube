import express from 'express'
import { Socket } from 'socket.io'
import { HttpStatusCode, HttpStatusCodeType, ServerErrorCodeType } from '@peertube/peertube-models'
import { getAccessToken } from '@server/lib/auth/oauth-model.js'
import { RunnerModel } from '@server/models/runner/runner.js'
import { logger } from '../helpers/logger.js'
import { handleOAuthAuthenticate } from '../lib/auth/oauth.js'

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

function authenticatePromise (options: {
  req: express.Request
  res: express.Response
  errorMessage?: string
  errorStatus?: HttpStatusCodeType
  errorType?: ServerErrorCodeType
}) {
  const { req, res, errorMessage = 'Not authenticated', errorStatus = HttpStatusCode.UNAUTHORIZED_401, errorType } = options
  return new Promise<void>(resolve => {
    // Already authenticated? (or tried to)
    if (res.locals.oauth?.token.User) return resolve()

    if (res.locals.authenticated === false) {
      return res.fail({
        status: errorStatus,
        type: errorType,
        message: errorMessage
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
