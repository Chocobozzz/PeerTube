import express from 'express'
import OAuth2Server, {
  InvalidClientError,
  InvalidGrantError,
  InvalidRequestError,
  Request,
  Response,
  UnauthorizedClientError,
  UnsupportedGrantTypeError
} from '@node-oauth/oauth2-server'
import { randomBytesPromise } from '@server/helpers/core-utils'
import { isOTPValid } from '@server/helpers/otp'
import { MOAuthClient } from '@server/types/models'
import { sha1 } from '@shared/extra-utils'
import { HttpStatusCode } from '@shared/models'
import { OAUTH_LIFETIME, OTP } from '../../initializers/constants'
import { BypassLogin, getClient, getRefreshToken, getUser, revokeToken, saveToken } from './oauth-model'

class MissingTwoFactorError extends Error {
  code = HttpStatusCode.UNAUTHORIZED_401
  name = 'missing_two_factor'
}

class InvalidTwoFactorError extends Error {
  code = HttpStatusCode.BAD_REQUEST_400
  name = 'invalid_two_factor'
}

/**
 *
 * Reimplement some functions of OAuth2Server to inject external auth methods
 *
 */
const oAuthServer = new OAuth2Server({
  accessTokenLifetime: OAUTH_LIFETIME.ACCESS_TOKEN,
  refreshTokenLifetime: OAUTH_LIFETIME.REFRESH_TOKEN,

  // See https://github.com/oauthjs/node-oauth2-server/wiki/Model-specification for the model specifications
  model: require('./oauth-model')
})

// ---------------------------------------------------------------------------

async function handleOAuthToken (req: express.Request, options: { refreshTokenAuthName?: string, bypassLogin?: BypassLogin }) {
  const request = new Request(req)
  const { refreshTokenAuthName, bypassLogin } = options

  if (request.method !== 'POST') {
    throw new InvalidRequestError('Invalid request: method must be POST')
  }

  if (!request.is([ 'application/x-www-form-urlencoded' ])) {
    throw new InvalidRequestError('Invalid request: content must be application/x-www-form-urlencoded')
  }

  const clientId = request.body.client_id
  const clientSecret = request.body.client_secret

  if (!clientId || !clientSecret) {
    throw new InvalidClientError('Invalid client: cannot retrieve client credentials')
  }

  const client = await getClient(clientId, clientSecret)
  if (!client) {
    throw new InvalidClientError('Invalid client: client is invalid')
  }

  const grantType = request.body.grant_type
  if (!grantType) {
    throw new InvalidRequestError('Missing parameter: `grant_type`')
  }

  if (![ 'password', 'refresh_token' ].includes(grantType)) {
    throw new UnsupportedGrantTypeError('Unsupported grant type: `grant_type` is invalid')
  }

  if (!client.grants.includes(grantType)) {
    throw new UnauthorizedClientError('Unauthorized client: `grant_type` is invalid')
  }

  if (grantType === 'password') {
    return handlePasswordGrant({
      request,
      client,
      bypassLogin
    })
  }

  return handleRefreshGrant({
    request,
    client,
    refreshTokenAuthName
  })
}

function handleOAuthAuthenticate (
  req: express.Request,
  res: express.Response,
  authenticateInQuery = false
) {
  const options = authenticateInQuery
    ? { allowBearerTokensInQueryString: true }
    : {}

  return oAuthServer.authenticate(new Request(req), new Response(res), options)
}

export {
  MissingTwoFactorError,
  InvalidTwoFactorError,

  handleOAuthToken,
  handleOAuthAuthenticate
}

// ---------------------------------------------------------------------------

async function handlePasswordGrant (options: {
  request: Request
  client: MOAuthClient
  bypassLogin?: BypassLogin
}) {
  const { request, client, bypassLogin } = options

  if (!request.body.username) {
    throw new InvalidRequestError('Missing parameter: `username`')
  }

  if (!bypassLogin && !request.body.password) {
    throw new InvalidRequestError('Missing parameter: `password`')
  }

  const user = await getUser(request.body.username, request.body.password, bypassLogin)
  if (!user) throw new InvalidGrantError('Invalid grant: user credentials are invalid')

  if (user.otpSecret) {
    if (!request.headers[OTP.HEADER_NAME]) {
      throw new MissingTwoFactorError('Missing two factor header')
    }

    if (await isOTPValid({ encryptedSecret: user.otpSecret, token: request.headers[OTP.HEADER_NAME] }) !== true) {
      throw new InvalidTwoFactorError('Invalid two factor header')
    }
  }

  const token = await buildToken()

  return saveToken(token, client, user, { bypassLogin })
}

async function handleRefreshGrant (options: {
  request: Request
  client: MOAuthClient
  refreshTokenAuthName: string
}) {
  const { request, client, refreshTokenAuthName } = options

  if (!request.body.refresh_token) {
    throw new InvalidRequestError('Missing parameter: `refresh_token`')
  }

  const refreshToken = await getRefreshToken(request.body.refresh_token)

  if (!refreshToken) {
    throw new InvalidGrantError('Invalid grant: refresh token is invalid')
  }

  if (refreshToken.client.id !== client.id) {
    throw new InvalidGrantError('Invalid grant: refresh token is invalid')
  }

  if (refreshToken.refreshTokenExpiresAt && refreshToken.refreshTokenExpiresAt < new Date()) {
    throw new InvalidGrantError('Invalid grant: refresh token has expired')
  }

  await revokeToken({ refreshToken: refreshToken.refreshToken })

  const token = await buildToken()

  return saveToken(token, client, refreshToken.user, { refreshTokenAuthName })
}

function generateRandomToken () {
  return randomBytesPromise(256)
    .then(buffer => sha1(buffer))
}

function getTokenExpiresAt (type: 'access' | 'refresh') {
  const lifetime = type === 'access'
    ? OAUTH_LIFETIME.ACCESS_TOKEN
    : OAUTH_LIFETIME.REFRESH_TOKEN

  return new Date(Date.now() + lifetime * 1000)
}

async function buildToken () {
  const [ accessToken, refreshToken ] = await Promise.all([ generateRandomToken(), generateRandomToken() ])

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: getTokenExpiresAt('access'),
    refreshTokenExpiresAt: getTokenExpiresAt('refresh')
  }
}
