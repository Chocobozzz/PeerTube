import { AccessDeniedError } from '@node-oauth/oauth2-server'
import { maskSecret, pick } from '@peertube/peertube-core-utils'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { isUserPasswordTooLong } from '@server/helpers/custom-validators/users.js'
import { PluginManager } from '@server/lib/plugins/plugin-manager.js'
import { AccountModel } from '@server/models/account/account.js'
import { AuthenticatedResultUpdaterFieldName, RegisterServerAuthenticatedResult } from '@server/types/index.js'
import { MOAuthClient } from '@server/types/models/index.js'
import { MUser, MUserDefault } from '@server/types/models/user/user.js'
import express from 'express'
import { logger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { OAuthClientModel } from '../../models/oauth/oauth-client.js'
import { OAuthTokenModel } from '../../models/oauth/oauth-token.js'
import { UserModel } from '../../models/user/user.js'
import { findAvailableLocalActorName } from '../local-actor.js'
import { buildUser, createUserAccountAndChannelAndPlaylist, getByEmailPermissive } from '../user.js'
import { ExternalUser } from './external-auth.js'
import { AccountBlockedError, EmailNotVerifiedError, TooLongPasswordError } from './oauth.js'
import { TokensCache } from './tokens-cache.js'

type TokenInfo = {
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

function getClient (clientId: string, clientSecret: string) {
  logger.debug('Getting Client (clientId: ' + clientId + ', clientSecret: ' + maskSecret(clientSecret) + ').')

  return OAuthClientModel.getByIdAndSecret(clientId, clientSecret)
}

async function getRefreshToken (refreshToken: string) {
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

// Keep this function signature, required by oauth2-server
async function getUser (usernameOrEmail?: string, password?: string, options?: {
  bypassLogin?: BypassLogin
  req: express.Request
}) {
  const { bypassLogin, req } = options

  // Special treatment coming from a plugin
  if (bypassLogin?.bypass === true) {
    logger.info('Bypassing oauth login by plugin %s.', bypassLogin.pluginName)

    const { pluginName, user: externalUser, userUpdater } = bypassLogin

    const user = await findExternalUserOrThrow({ externalUser, pluginName, userUpdater, req })

    // If the user does not belongs to a plugin, it was created before its installation
    // Then we just go through a regular login process
    if (user.pluginAuth !== null) {
      // This user does not belong to this plugin, skip it
      if (user.pluginAuth !== pluginName) {
        logger.info(
          'Cannot bypass oauth login by plugin %s because %s has another plugin auth method (%s).',
          pluginName,
          externalUser.email,
          user.pluginAuth
        )

        return null
      }

      checkUserValidityOrThrow(user, req)

      return user
    }
  }

  logger.debug('Getting User (username/email: ' + usernameOrEmail + ', password: ******).')

  const users = await UserModel.loadByUsernameOrEmailCaseInsensitive(usernameOrEmail)
  let user: MUserDefault

  if (usernameOrEmail.includes('@')) {
    user = getByEmailPermissive(users, usernameOrEmail)
  } else if (users.length === 1) {
    user = users[0]
  }

  // If we don't find the user, or if the user belongs to a plugin
  if (user?.pluginAuth !== null || !password) return null

  if (isRootAuthDisabled(user)) return null

  const passwordMatch = await user.isPasswordMatch(password)
  if (passwordMatch !== true) return null

  if (isUserPasswordTooLong(password)) {
    throw new TooLongPasswordError(req.t('Password is too long. Please reset it using the password reset procedure.'))
  }

  checkUserValidityOrThrow(user, req)

  if (CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION && user.emailVerified === false) {
    // Keep this message sync with the client
    // TODO: use custom server code
    throw new EmailNotVerifiedError(req.t('User email is not verified.'))
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

export {
  getAccessToken,
  getClient,
  getRefreshToken,
  getUser,
  revokeToken,
  saveToken
}

// ---------------------------------------------------------------------------

async function findExternalUserOrThrow (options: {
  externalUser: ExternalUser
  pluginName: string
  userUpdater: RegisterServerAuthenticatedResult['userUpdater']
  req: express.Request
}): Promise<MUserDefault> {
  const { externalUser, pluginName, userUpdater, req } = options

  if (externalUser.externalId) {
    const userByExternalId = await UserModel.loadByPluginAuthExternalId(pluginName, externalUser.externalId)

    if (userByExternalId) {
      // Authoritative match by stable external id: trust it even if the email changed at the identity provider
      return updateUserFromExternal({ user: userByExternalId, userOptions: externalUser, userUpdater, syncEmail: true })
    }
  }

  // Plugin does not supply a stable external id: unchanged email-only behavior
  const userByEmail = getByEmailPermissive(await UserModel.loadByEmailCaseInsensitive(externalUser.email), externalUser.email)
  if (!userByEmail) return createUserFromExternal(pluginName, externalUser)

  if (userByEmail.pluginAuth === pluginName) {
    if (externalUser.externalId && userByEmail.pluginAuthExternalId !== null) {
      // This account is already linked to a different external id for this plugin
      // Refuse to silently relink (identity provider email reuse, or a possible hijack attempt)
      throw new AccessDeniedError(
        req.t(
          `Refusing external auth bypass for plugin {pluginName}: {email} is already linked to a different external id.`,
          { pluginName, email: externalUser.email }
        )
      )
    }

    return updateUserFromExternal({ user: userByEmail, userOptions: externalUser, userUpdater, syncEmail: false })
  }

  return userByEmail
}

async function createUserFromExternal (pluginAuth: string, userOptions: ExternalUser) {
  const username = await findAvailableLocalActorName(userOptions.username)

  const userToCreate = buildUser({
    ...pick(userOptions, [ 'email', 'role', 'adminFlags', 'videoQuota', 'videoQuotaDaily' ]),

    username,
    emailVerified: null,
    password: null,
    pluginAuth,
    pluginAuthExternalId: userOptions.externalId
  })

  const { user } = await createUserAccountAndChannelAndPlaylist({
    userToCreate,
    userDisplayName: userOptions.displayName
  })

  return user
}

async function updateUserFromExternal (options: {
  user: MUserDefault
  userOptions: ExternalUser
  userUpdater: RegisterServerAuthenticatedResult['userUpdater']
  syncEmail: boolean
}) {
  const { user, userOptions, userUpdater, syncEmail } = options

  if (userUpdater) {
    {
      type UserAttributeKeys = keyof AttributesOnly<UserModel>
      const mappingKeys: { [id in UserAttributeKeys]?: AuthenticatedResultUpdaterFieldName } = {
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
      const mappingKeys: { [id in AccountAttributeKeys]?: AuthenticatedResultUpdaterFieldName } = {
        name: 'displayName'
      }

      for (const modelKey of Object.keys(mappingKeys)) {
        const optionKey = mappingKeys[modelKey]

        const newValue = userUpdater({ fieldName: optionKey, currentValue: user.Account[modelKey], newValue: userOptions[optionKey] })
        user.Account.set(modelKey, newValue)
      }
    }

    logger.debug('Updated user %s with plugin userUpdated function.', user.email, { user, userOptions })
  }

  if (userOptions.externalId && user.pluginAuthExternalId !== userOptions.externalId) {
    logger.info('Linking external id for user %s (plugin %s).', user.email, user.pluginAuth)
    user.set('pluginAuthExternalId', userOptions.externalId)
  }

  if (syncEmail && userOptions.email && user.email !== userOptions.email) {
    logger.info('Updating email of user %s to %s after successful external auth.', user.email, userOptions.email)
    user.email = userOptions.email
  }

  user.Account = await user.Account.save()

  return user.save()
}

function checkUserValidityOrThrow (user: MUser, req: express.Request) {
  if (user.blocked) throw new AccountBlockedError(req.t('User is blocked.'))
}

function buildExpiresIn (expiresAt: Date) {
  return Math.floor((expiresAt.getTime() - new Date().getTime()) / 1000)
}

function isRootAuthDisabled (user: Pick<MUser, 'username'>) {
  return CONFIG.USER.DISABLE_ROOT_AUTH === true && user.username === 'root'
}
