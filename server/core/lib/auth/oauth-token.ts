import { maskSecret, pick } from '@peertube/peertube-core-utils'
import { sha1 } from '@peertube/peertube-node-utils'
import { randomBytesPromise } from '@server/helpers/core-utils.js'
import { PluginManager } from '@server/lib/plugins/plugin-manager.js'
import { MOAuthClient } from '@server/types/models/index.js'
import { MUser } from '@server/types/models/user/user.js'
import express from 'express'
import { logger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { OAuthTokenModel } from '../../models/oauth/oauth-token.js'
import { isRootAuthDisabled } from './auth-utils.js'
import { BypassLogin } from './bypass-login.model.js'
import { TokensCache } from './tokens-cache.js'

export async function getAccessToken (bearerToken: string) {
  logger.debug('Getting access token.')

  if (!bearerToken) return undefined

  let tokenModel = TokensCache.Instance.getToken(bearerToken)

  if (!tokenModel) {
    tokenModel = await OAuthTokenModel.getByTokenAndPopulateUser(bearerToken)

    if (tokenModel) TokensCache.Instance.setToken(tokenModel)
  }

  if (!tokenModel) return undefined

  if (isRootAuthDisabled(tokenModel.User)) return undefined

  if (tokenModel.User.pluginAuth) {
    const valid = await PluginManager.Instance.isTokenValid(tokenModel, 'access')

    if (valid !== true) return undefined
  }

  return tokenModel
}

export async function getRefreshToken (refreshToken: string) {
  logger.debug('Getting RefreshToken (refreshToken: ' + maskSecret(refreshToken) + ').')

  const tokenInfo = await OAuthTokenModel.getByRefreshTokenAndPopulateClient(refreshToken)
  if (!tokenInfo) return undefined

  const tokenModel = tokenInfo.token

  if (isRootAuthDisabled(tokenModel.User)) return undefined

  if (tokenModel.User.pluginAuth) {
    const valid = await PluginManager.Instance.isTokenValid(tokenModel, 'refresh')

    if (valid !== true) return undefined
  }

  return tokenInfo
}

export async function revokeToken (
  tokenInfo: { refreshToken: string },
  options: {
    req?: express.Request
    explicitLogout?: boolean
  } = {}
): Promise<{ success: boolean, redirectUrl?: string }> {
  const { req, explicitLogout } = options

  const token = await OAuthTokenModel.getByRefreshTokenAndPopulateUser(tokenInfo.refreshToken)

  if (token) {
    let redirectUrl: string

    if (explicitLogout === true && token.User.pluginAuth && token.authName) {
      redirectUrl = await PluginManager.Instance.onLogout(token.User.pluginAuth, token.authName, token.User, req)
    }

    TokensCache.Instance.deleteToken(token.accessToken)

    try {
      await token.destroy()
    } catch (err) {
      logger.error('Cannot destroy token when revoking token.', { err })
    }

    return { success: true, redirectUrl }
  }

  return { success: false }
}

export type TokenInfo = {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt: Date
  loginDevice: string
  loginIP: string
  loginDate: Date
  lastActivityDevice: string
  lastActivityIP: string
  lastActivityDate: Date
}

export async function buildToken (options: {
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

export async function saveToken (
  token: TokenInfo,
  client: MOAuthClient,
  user: MUser,
  options: {
    refreshTokenAuthName?: string
    bypassLogin?: BypassLogin
  } = {}
) {
  const { refreshTokenAuthName, bypassLogin } = options
  let authName: string = null

  if (bypassLogin?.bypass === true) {
    authName = bypassLogin.authName
  } else if (refreshTokenAuthName) {
    authName = refreshTokenAuthName
  }

  logger.debug(`Saving token ${maskSecret(token.accessToken)} for client ${client.id} and user ${user.id}.`)

  const tokenToCreate = {
    ...pick(token, [
      'accessToken',
      'refreshToken',
      'accessTokenExpiresAt',
      'refreshTokenExpiresAt',
      'loginDevice',
      'loginIP',
      'loginDate',
      'lastActivityDate',
      'lastActivityDevice',
      'lastActivityIP'
    ]),
    authName,
    oAuthClientId: client.id,
    userId: user.id
  }

  const tokenCreated = await OAuthTokenModel.create(tokenToCreate)

  user.lastLoginDate = new Date()
  await user.save()

  return {
    accessToken: tokenCreated.accessToken,
    accessTokenExpiresAt: tokenCreated.accessTokenExpiresAt,
    refreshToken: tokenCreated.refreshToken,
    refreshTokenExpiresAt: tokenCreated.refreshTokenExpiresAt,
    client,
    user,
    accessTokenExpiresIn: buildExpiresIn(tokenCreated.accessTokenExpiresAt),
    refreshTokenExpiresIn: buildExpiresIn(tokenCreated.refreshTokenExpiresAt)
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function buildExpiresIn (expiresAt: Date) {
  return Math.floor((expiresAt.getTime() - new Date().getTime()) / 1000)
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
