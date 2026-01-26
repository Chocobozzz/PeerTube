import OAuth2Server, {
  InvalidClientError,
  InvalidGrantError,
  InvalidRequestError,
  Request,
  Response,
  UnauthorizedClientError,
  UnsupportedGrantTypeError
} from '@node-oauth/oauth2-server'
import { pick } from '@peertube/peertube-core-utils'
import { HttpStatusCode, ServerErrorCode, UserRegistrationState } from '@peertube/peertube-models'
import { sha1 } from '@peertube/peertube-node-utils'
import { randomBytesPromise } from '@server/helpers/core-utils.js'
import { isOTPValid } from '@server/helpers/otp.js'
import { CONFIG } from '@server/initializers/config.js'
import { UserRegistrationModel } from '@server/models/user/user-registration.js'
import { MOAuthClient } from '@server/types/models/index.js'
import express from 'express'
import { OTP } from '../../initializers/constants.js'
import { Hooks } from '../plugins/hooks.js'
import { BypassLogin, getAccessToken, getClient, getRefreshToken, getUser, revokeToken, saveToken } from './oauth-model.js'

class MissingTwoFactorError extends Error {
  code = HttpStatusCode.UNAUTHORIZED_401
  name = ServerErrorCode.MISSING_TWO_FACTOR
}

class TooLongPasswordError extends Error {
  code = HttpStatusCode.BAD_REQUEST_400
  name = ServerErrorCode.TOO_LONG_PASSWORD
}

class AccountBlockedError extends Error {
  code = HttpStatusCode.BAD_REQUEST_400
  name = ServerErrorCode.ACCOUNT_BLOCKED
}

class EmailNotVerifiedError extends Error {
  code = HttpStatusCode.BAD_REQUEST_400
  name = ServerErrorCode.EMAIL_NOT_VERIFIED
}

class InvalidTwoFactorError extends Error {
  code = HttpStatusCode.BAD_REQUEST_400
  name = ServerErrorCode.INVALID_TWO_FACTOR
}

class RegistrationWaitingForApproval extends Error {
  code = HttpStatusCode.BAD_REQUEST_400
  name = ServerErrorCode.ACCOUNT_WAITING_FOR_APPROVAL
}

class RegistrationApprovalRejected extends Error {
  code = HttpStatusCode.BAD_REQUEST_400
  name = ServerErrorCode.ACCOUNT_APPROVAL_REJECTED
}

/**
 * Reimplement some functions of OAuth2Server to inject external auth methods
 */
const oAuthServer = new OAuth2Server({
  // Wants seconds
  accessTokenLifetime: CONFIG.OAUTH2.TOKEN_LIFETIME.ACCESS_TOKEN / 1000,
  refreshTokenLifetime: CONFIG.OAUTH2.TOKEN_LIFETIME.REFRESH_TOKEN / 1000,

  // See https://github.com/oauthjs/node-oauth2-server/wiki/Model-specification for the model specifications
  model: {
    getAccessToken,
    getClient,
    getRefreshToken,
    getUser,
    revokeToken,
    saveToken
  } as any // FIXME: typings
})

// ---------------------------------------------------------------------------

async function handleOAuthToken (req: express.Request, options: { refreshTokenAuthName?: string, bypassLogin?: BypassLogin }) {
  const oauthRequest = new Request(req)
  const { refreshTokenAuthName, bypassLogin } = options

  if (oauthRequest.method !== 'POST') {
    throw new InvalidRequestError('Invalid request: method must be POST')
  }

  if (!oauthRequest.is([ 'application/x-www-form-urlencoded' ])) {
    throw new InvalidRequestError('Invalid request: content must be application/x-www-form-urlencoded')
  }

  const clientId = oauthRequest.body.client_id
  const clientSecret = oauthRequest.body.client_secret

  if (!clientId || !clientSecret) {
    throw new InvalidClientError('Invalid client: cannot retrieve client credentials')
  }

  const client = await getClient(clientId, clientSecret)
  if (!client) {
    throw new InvalidClientError('Invalid client: client is invalid')
  }

  const grantType = oauthRequest.body.grant_type
  if (!grantType) {
    throw new InvalidRequestError('Missing parameter: `grant_type`')
  }

  if (![ 'password', 'refresh_token' ].includes(grantType)) {
    throw new UnsupportedGrantTypeError('Unsupported grant type: `grant_type` is invalid')
  }

  if (!client.grants.includes(grantType)) {
    throw new UnauthorizedClientError('Unauthorized client: `grant_type` is invalid')
  }

  const ip = req.ip
  const userAgent = req.headers['user-agent']

  if (grantType === 'password') {
    return handlePasswordGrant({
      req,
      oauthRequest,
      client,
      bypassLogin,
      ip,
      userAgent
    })
  }

  return handleRefreshGrant({
    req,
    oauthRequest,
    client,
    refreshTokenAuthName,
    ip,
    userAgent
  })
}

function handleOAuthAuthenticate (
  req: express.Request,
  res: express.Response
) {
  return oAuthServer.authenticate(new Request(req), new Response(res))
}

export {
  handleOAuthAuthenticate,
  handleOAuthToken,
  InvalidTwoFactorError,
  MissingTwoFactorError,
  TooLongPasswordError,
  AccountBlockedError,
  EmailNotVerifiedError
}

// ---------------------------------------------------------------------------

async function handlePasswordGrant (options: {
  req: express.Request
  oauthRequest: Request
  client: MOAuthClient
  bypassLogin?: BypassLogin
  ip: string
  userAgent: string
}) {
  const { req, oauthRequest, client } = options

  const { bypassLogin, usernameOrEmail, password } = await Hooks.wrapObject({
    bypassLogin: options.bypassLogin,
    usernameOrEmail: oauthRequest.body.username,
    password: oauthRequest.body.password
  }, 'filter:oauth.password-grant.get-user.params')

  if (!options.oauthRequest.body.username) {
    throw new InvalidRequestError(req.t('Missing parameter: `username`'))
  }

  if (!bypassLogin && !options.oauthRequest.body.password) {
    throw new InvalidRequestError(req.t('Missing parameter: `password`'))
  }

  const user = await getUser(usernameOrEmail, password, { bypassLogin, req })
  if (!user) {
    const registrations = await UserRegistrationModel.listByEmailCaseInsensitiveOrUsername(usernameOrEmail)

    if (registrations.length === 1) {
      if (registrations[0].state === UserRegistrationState.REJECTED) {
        throw new RegistrationApprovalRejected(req.t('Registration approval for this account has been rejected'))
      } else if (registrations[0].state === UserRegistrationState.PENDING) {
        throw new RegistrationWaitingForApproval(req.t('Registration for this account is awaiting approval'))
      }
    }

    throw new InvalidGrantError(req.t('Invalid grant: user credentials are invalid'))
  }

  if (user.otpSecret) {
    if (!options.oauthRequest.headers[OTP.HEADER_NAME]) {
      throw new MissingTwoFactorError(req.t('Missing two factor header'))
    }

    if (await isOTPValid({ encryptedSecret: user.otpSecret, token: options.oauthRequest.headers[OTP.HEADER_NAME] }) !== true) {
      throw new InvalidTwoFactorError(req.t('Invalid two factor header'))
    }
  }

  const now = new Date()

  const token = await buildToken({
    loginDevice: options.userAgent,
    loginIP: options.ip,
    loginDate: now,
    lastActivityDevice: options.userAgent,
    lastActivityIP: options.ip,
    lastActivityDate: now
  })

  return saveToken(token, client, user, { bypassLogin })
}

async function handleRefreshGrant (options: {
  req: express.Request
  oauthRequest: Request
  client: MOAuthClient
  refreshTokenAuthName: string
  ip: string
  userAgent: string
}) {
  const { req, oauthRequest, client, refreshTokenAuthName } = options

  if (!oauthRequest.body.refresh_token) {
    throw new InvalidRequestError(req.t('Missing parameter: `refresh_token`'))
  }

  const refreshToken = await getRefreshToken(oauthRequest.body.refresh_token)

  if (!refreshToken) {
    throw new InvalidGrantError(req.t('Invalid grant: refresh token is invalid'))
  }

  if (refreshToken.client.id !== client.id) {
    throw new InvalidGrantError(req.t('Invalid grant: refresh token is invalid'))
  }

  if (refreshToken.refreshTokenExpiresAt && refreshToken.refreshTokenExpiresAt < new Date()) {
    throw new InvalidGrantError(req.t('Invalid grant: refresh token has expired'))
  }

  await revokeToken({ refreshToken: refreshToken.refreshToken })

  const token = await buildToken({
    lastActivityDevice: options.userAgent,
    lastActivityIP: options.ip,
    lastActivityDate: new Date(),

    loginIP: refreshToken.token.loginIP,
    loginDate: refreshToken.token.loginDate,
    loginDevice: refreshToken.token.loginDevice
  })

  return saveToken(token, client, refreshToken.user, { refreshTokenAuthName })
}

function generateRandomToken () {
  return randomBytesPromise(256)
    .then(buffer => sha1(buffer))
}

function getTokenExpiresAt (type: 'access' | 'refresh') {
  const lifetime = type === 'access'
    ? CONFIG.OAUTH2.TOKEN_LIFETIME.ACCESS_TOKEN
    : CONFIG.OAUTH2.TOKEN_LIFETIME.REFRESH_TOKEN

  return new Date(Date.now() + lifetime)
}

async function buildToken (options: {
  loginDevice: string
  loginIP: string
  loginDate: Date
  lastActivityDevice: string
  lastActivityIP: string
  lastActivityDate: Date
}) {
  const [ accessToken, refreshToken ] = await Promise.all([ generateRandomToken(), generateRandomToken() ])

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: getTokenExpiresAt('access'),
    refreshTokenExpiresAt: getTokenExpiresAt('refresh'),

    ...pick(options, [
      'loginDevice',
      'loginIP',
      'loginDate',
      'lastActivityDevice',
      'lastActivityIP',
      'lastActivityDate'
    ])
  }
}
