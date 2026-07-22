import OAuth2Server, {
  InvalidClientError,
  InvalidGrantError,
  InvalidRequestError,
  Request,
  Response,
  UnauthorizedClientError,
  UnsupportedGrantTypeError
} from '@node-oauth/oauth2-server'
import { maskSecret } from '@peertube/peertube-core-utils'
import { isUserPasswordTooLong } from '@server/helpers/custom-validators/users.js'
import { MOAuthClient } from '@server/types/models/index.js'
import express from 'express'
import { logger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { OAuthClientModel } from '../../models/oauth/oauth-client.js'
import { Hooks } from '../plugins/hooks.js'
import { BypassLogin } from './bypass-login.model.js'
import { TooLongPasswordError } from './oauth-errors.js'
import { buildToken, getAccessToken, getRefreshToken, revokeToken, saveToken } from './oauth-token.js'
import { getUserOrThrow } from './oauth-user.js'

/**
 * Reimplement some functions of OAuth2Server to inject external auth methods
 */
const oAuthServer = new OAuth2Server({
  // Wants seconds
  accessTokenLifetime: CONFIG.OAUTH2.TOKEN_LIFETIME.ACCESS_TOKEN / 1000,
  refreshTokenLifetime: CONFIG.OAUTH2.TOKEN_LIFETIME.REFRESH_TOKEN / 1000,

  // oAuthServer is only used for .authenticate() below, which only calls model.getAccessToken()
  // (getClient/getRefreshToken/revokeToken/saveToken are called directly, bypassing the OAuth2Server model contract)
  // See https://github.com/oauthjs/node-oauth2-server/wiki/Model-specification for the model specifications
  model: { getAccessToken } as any // FIXME: typings
})

// ---------------------------------------------------------------------------

export async function handleOAuthToken (req: express.Request, options: { refreshTokenAuthName?: string, bypassLogin?: BypassLogin }) {
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

export function handleOAuthAuthenticate (
  req: express.Request,
  res: express.Response
) {
  return oAuthServer.authenticate(new Request(req), new Response(res))
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

  if (!usernameOrEmail) {
    throw new InvalidRequestError(req.t('Missing parameter: `username`'))
  }

  if (!bypassLogin && !password) {
    throw new InvalidRequestError(req.t('Missing parameter: `password`'))
  }

  if (password && isUserPasswordTooLong(password)) {
    throw new TooLongPasswordError(req.t('Password is too long. Please reset it using the password reset procedure.'))
  }

  const user = await getUserOrThrow({ usernameOrEmail, password, bypassLogin, req, oauthHeaders: options.oauthRequest.headers })

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

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function getClient (clientId: string, clientSecret: string) {
  logger.debug('Getting Client (clientId: ' + clientId + ', clientSecret: ' + maskSecret(clientSecret) + ').')

  return OAuthClientModel.getByIdAndSecret(clientId, clientSecret)
}
