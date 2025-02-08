import express from 'express'
import { AccessDeniedError } from '@node-oauth/oauth2-server'
import { PluginManager } from '@server/lib/plugins/plugin-manager.js'
import { AccountModel } from '@server/models/account/account.js'
import { AuthenticatedResultUpdaterFieldName, RegisterServerAuthenticatedResult } from '@server/types/index.js'
import { MOAuthClient } from '@server/types/models/index.js'
import { MOAuthTokenUser } from '@server/types/models/oauth/oauth-token.js'
import { MUser, MUserDefault } from '@server/types/models/user/user.js'
import { pick } from '@peertube/peertube-core-utils'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { logger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { OAuthClientModel } from '../../models/oauth/oauth-client.js'
import { OAuthTokenModel } from '../../models/oauth/oauth-token.js'
import { UserModel } from '../../models/user/user.js'
import { findAvailableLocalActorName } from '../local-actor.js'
import { buildUser, createUserAccountAndChannelAndPlaylist, getUserByEmailPermissive } from '../user.js'
import { ExternalUser } from './external-auth.js'
import { TokensCache } from './tokens-cache.js'

type TokenInfo = {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt: Date
}

export type BypassLogin = {
  bypass: boolean
  pluginName: string
  authName?: string
  user: ExternalUser
  userUpdater: RegisterServerAuthenticatedResult['userUpdater']
}

async function getAccessToken (bearerToken: string) {
  logger.debug('Getting access token.')

  if (!bearerToken) return undefined

  let tokenModel: MOAuthTokenUser

  if (TokensCache.Instance.hasToken(bearerToken)) {
    tokenModel = TokensCache.Instance.getByToken(bearerToken)
  } else {
    tokenModel = await OAuthTokenModel.getByTokenAndPopulateUser(bearerToken)

    if (tokenModel) TokensCache.Instance.setToken(tokenModel)
  }

  if (!tokenModel) return undefined

  if (tokenModel.User.pluginAuth) {
    const valid = await PluginManager.Instance.isTokenValid(tokenModel, 'access')

    if (valid !== true) return undefined
  }

  return tokenModel
}

function getClient (clientId: string, clientSecret: string) {
  logger.debug('Getting Client (clientId: ' + clientId + ', clientSecret: ' + clientSecret + ').')

  return OAuthClientModel.getByIdAndSecret(clientId, clientSecret)
}

async function getRefreshToken (refreshToken: string) {
  logger.debug('Getting RefreshToken (refreshToken: ' + refreshToken + ').')

  const tokenInfo = await OAuthTokenModel.getByRefreshTokenAndPopulateClient(refreshToken)
  if (!tokenInfo) return undefined

  const tokenModel = tokenInfo.token

  if (tokenModel.User.pluginAuth) {
    const valid = await PluginManager.Instance.isTokenValid(tokenModel, 'refresh')

    if (valid !== true) return undefined
  }

  return tokenInfo
}

async function getUser (usernameOrEmail?: string, password?: string, bypassLogin?: BypassLogin) {
  // Special treatment coming from a plugin
  if (bypassLogin && bypassLogin.bypass === true) {
    logger.info('Bypassing oauth login by plugin %s.', bypassLogin.pluginName)

    let user = getUserByEmailPermissive(await UserModel.loadByEmailCaseInsensitive(bypassLogin.user.email), bypassLogin.user.email)

    if (!user) {
      user = await createUserFromExternal(bypassLogin.pluginName, bypassLogin.user)
    } else if (user.pluginAuth === bypassLogin.pluginName) {
      user = await updateUserFromExternal(user, bypassLogin.user, bypassLogin.userUpdater)
    }

    // Cannot create a user
    if (!user) throw new AccessDeniedError('Cannot create such user: an actor with that name already exists.')

    // If the user does not belongs to a plugin, it was created before its installation
    // Then we just go through a regular login process
    if (user.pluginAuth !== null) {
      // This user does not belong to this plugin, skip it
      if (user.pluginAuth !== bypassLogin.pluginName) {
        logger.info(
          'Cannot bypass oauth login by plugin %s because %s has another plugin auth method (%s).',
          bypassLogin.pluginName, bypassLogin.user.email, user.pluginAuth
        )

        return null
      }

      checkUserValidityOrThrow(user)

      return user
    }
  }

  logger.debug('Getting User (username/email: ' + usernameOrEmail + ', password: ******).')

  const users = await UserModel.loadByUsernameOrEmailCaseInsensitive(usernameOrEmail)
  let user: MUserDefault

  if (usernameOrEmail.includes('@')) {
    user = getUserByEmailPermissive(users, usernameOrEmail)
  } else if (users.length === 1) {
    user = users[0]
  }

  // If we don't find the user, or if the user belongs to a plugin
  if (!user || user.pluginAuth !== null || !password) return null

  const passwordMatch = await user.isPasswordMatch(password)
  if (passwordMatch !== true) return null

  checkUserValidityOrThrow(user)

  if (CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION && user.emailVerified === false) {
    // Keep this message sync with the client
    // TODO: use custom server code
    throw new AccessDeniedError('User email is not verified.')
  }

  return user
}

async function revokeToken (
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

    TokensCache.Instance.clearCacheByToken(token.accessToken)

    token.destroy()
         .catch(err => logger.error('Cannot destroy token when revoking token.', { err }))

    return { success: true, redirectUrl }
  }

  return { success: false }
}

async function saveToken (
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

  logger.debug('Saving token ' + token.accessToken + ' for client ' + client.id + ' and user ' + user.id + '.')

  const tokenToCreate = {
    accessToken: token.accessToken,
    accessTokenExpiresAt: token.accessTokenExpiresAt,
    refreshToken: token.refreshToken,
    refreshTokenExpiresAt: token.refreshTokenExpiresAt,
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

export {
  getAccessToken,
  getClient,
  getRefreshToken,
  getUser,
  revokeToken,
  saveToken
}

// ---------------------------------------------------------------------------

async function createUserFromExternal (pluginAuth: string, userOptions: ExternalUser) {
  const username = await findAvailableLocalActorName(userOptions.username)

  const userToCreate = buildUser({
    ...pick(userOptions, [ 'email', 'role', 'adminFlags', 'videoQuota', 'videoQuotaDaily' ]),

    username,
    emailVerified: null,
    password: null,
    pluginAuth
  })

  const { user } = await createUserAccountAndChannelAndPlaylist({
    userToCreate,
    userDisplayName: userOptions.displayName
  })

  return user
}

async function updateUserFromExternal (
  user: MUserDefault,
  userOptions: ExternalUser,
  userUpdater: RegisterServerAuthenticatedResult['userUpdater']
) {
  if (!userUpdater) return user

  {
    type UserAttributeKeys = keyof AttributesOnly<UserModel>
    const mappingKeys: { [ id in UserAttributeKeys ]?: AuthenticatedResultUpdaterFieldName } = {
      role: 'role',
      adminFlags: 'adminFlags',
      videoQuota: 'videoQuota',
      videoQuotaDaily: 'videoQuotaDaily'
    }

    for (const modelKey of Object.keys(mappingKeys)) {
      const pluginOptionKey = mappingKeys[modelKey]

      const newValue = userUpdater({ fieldName: pluginOptionKey, currentValue: user[modelKey], newValue: userOptions[pluginOptionKey] })
      user.set(modelKey, newValue)
    }
  }

  {
    type AccountAttributeKeys = keyof Partial<AttributesOnly<AccountModel>>
    const mappingKeys: { [ id in AccountAttributeKeys ]?: AuthenticatedResultUpdaterFieldName } = {
      name: 'displayName'
    }

    for (const modelKey of Object.keys(mappingKeys)) {
      const optionKey = mappingKeys[modelKey]

      const newValue = userUpdater({ fieldName: optionKey, currentValue: user.Account[modelKey], newValue: userOptions[optionKey] })
      user.Account.set(modelKey, newValue)
    }
  }

  logger.debug('Updated user %s with plugin userUpdated function.', user.email, { user, userOptions })

  user.Account = await user.Account.save()

  return user.save()
}

function checkUserValidityOrThrow (user: MUser) {
  if (user.blocked) throw new AccessDeniedError('User is blocked.')
}

function buildExpiresIn (expiresAt: Date) {
  return Math.floor((expiresAt.getTime() - new Date().getTime()) / 1000)
}
