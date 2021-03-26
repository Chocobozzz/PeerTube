
import { isUserDisplayNameValid, isUserRoleValid, isUserUsernameValid } from '@server/helpers/custom-validators/users'
import { logger } from '@server/helpers/logger'
import { generateRandomString } from '@server/helpers/utils'
import { PLUGIN_EXTERNAL_AUTH_TOKEN_LIFETIME } from '@server/initializers/constants'
import { PluginManager } from '@server/lib/plugins/plugin-manager'
import { OAuthTokenModel } from '@server/models/oauth/oauth-token'
import {
  RegisterServerAuthenticatedResult,
  RegisterServerAuthPassOptions,
  RegisterServerExternalAuthenticatedResult
} from '@server/types/plugins/register-server-auth.model'
import { UserRole } from '@shared/models'

// Token is the key, expiration date is the value
const authBypassTokens = new Map<string, {
  expires: Date
  user: {
    username: string
    email: string
    displayName: string
    role: UserRole
  }
  authName: string
  npmName: string
}>()

async function onExternalUserAuthenticated (options: {
  npmName: string
  authName: string
  authResult: RegisterServerExternalAuthenticatedResult
}) {
  const { npmName, authName, authResult } = options

  if (!authResult.req || !authResult.res) {
    logger.error('Cannot authenticate external user for auth %s of plugin %s: no req or res are provided.', authName, npmName)
    return
  }

  const { res } = authResult

  if (!isAuthResultValid(npmName, authName, authResult)) {
    res.redirect('/login?externalAuthError=true')
    return
  }

  logger.info('Generating auth bypass token for %s in auth %s of plugin %s.', authResult.username, authName, npmName)

  const bypassToken = await generateRandomString(32)

  const expires = new Date()
  expires.setTime(expires.getTime() + PLUGIN_EXTERNAL_AUTH_TOKEN_LIFETIME)

  const user = buildUserResult(authResult)
  authBypassTokens.set(bypassToken, {
    expires,
    user,
    npmName,
    authName
  })

  // Cleanup expired tokens
  const now = new Date()
  for (const [ key, value ] of authBypassTokens) {
    if (value.expires.getTime() < now.getTime()) {
      authBypassTokens.delete(key)
    }
  }

  res.redirect(`/login?externalAuthToken=${bypassToken}&username=${user.username}`)
}

async function getAuthNameFromRefreshGrant (refreshToken?: string) {
  if (!refreshToken) return undefined

  const tokenModel = await OAuthTokenModel.loadByRefreshToken(refreshToken)

  return tokenModel?.authName
}

async function getBypassFromPasswordGrant (username: string, password: string) {
  const plugins = PluginManager.Instance.getIdAndPassAuths()
  const pluginAuths: { npmName?: string, registerAuthOptions: RegisterServerAuthPassOptions }[] = []

  for (const plugin of plugins) {
    const auths = plugin.idAndPassAuths

    for (const auth of auths) {
      pluginAuths.push({
        npmName: plugin.npmName,
        registerAuthOptions: auth
      })
    }
  }

  pluginAuths.sort((a, b) => {
    const aWeight = a.registerAuthOptions.getWeight()
    const bWeight = b.registerAuthOptions.getWeight()

    // DESC weight order
    if (aWeight === bWeight) return 0
    if (aWeight < bWeight) return 1
    return -1
  })

  const loginOptions = {
    id: username,
    password
  }

  for (const pluginAuth of pluginAuths) {
    const authOptions = pluginAuth.registerAuthOptions
    const authName = authOptions.authName
    const npmName = pluginAuth.npmName

    logger.debug(
      'Using auth method %s of plugin %s to login %s with weight %d.',
      authName, npmName, loginOptions.id, authOptions.getWeight()
    )

    try {
      const loginResult = await authOptions.login(loginOptions)

      if (!loginResult) continue
      if (!isAuthResultValid(pluginAuth.npmName, authOptions.authName, loginResult)) continue

      logger.info(
        'Login success with auth method %s of plugin %s for %s.',
        authName, npmName, loginOptions.id
      )

      return {
        bypass: true,
        pluginName: pluginAuth.npmName,
        authName: authOptions.authName,
        user: buildUserResult(loginResult)
      }
    } catch (err) {
      logger.error('Error in auth method %s of plugin %s', authOptions.authName, pluginAuth.npmName, { err })
    }
  }

  return undefined
}

function getBypassFromExternalAuth (username: string, externalAuthToken: string) {
  const obj = authBypassTokens.get(externalAuthToken)
  if (!obj) throw new Error('Cannot authenticate user with unknown bypass token')

  const { expires, user, authName, npmName } = obj

  const now = new Date()
  if (now.getTime() > expires.getTime()) {
    throw new Error('Cannot authenticate user with an expired external auth token')
  }

  if (user.username !== username) {
    throw new Error(`Cannot authenticate user ${user.username} with invalid username ${username}`)
  }

  logger.info(
    'Auth success with external auth method %s of plugin %s for %s.',
    authName, npmName, user.email
  )

  return {
    bypass: true,
    pluginName: npmName,
    authName: authName,
    user
  }
}

function isAuthResultValid (npmName: string, authName: string, result: RegisterServerAuthenticatedResult) {
  if (!isUserUsernameValid(result.username)) {
    logger.error('Auth method %s of plugin %s did not provide a valid username.', authName, npmName, { username: result.username })
    return false
  }

  if (!result.email) {
    logger.error('Auth method %s of plugin %s did not provide a valid email.', authName, npmName, { email: result.email })
    return false
  }

  // role is optional
  if (result.role && !isUserRoleValid(result.role)) {
    logger.error('Auth method %s of plugin %s did not provide a valid role.', authName, npmName, { role: result.role })
    return false
  }

  // display name is optional
  if (result.displayName && !isUserDisplayNameValid(result.displayName)) {
    logger.error(
      'Auth method %s of plugin %s did not provide a valid display name.',
      authName, npmName, { displayName: result.displayName }
    )
    return false
  }

  return true
}

function buildUserResult (pluginResult: RegisterServerAuthenticatedResult) {
  return {
    username: pluginResult.username,
    email: pluginResult.email,
    role: pluginResult.role ?? UserRole.USER,
    displayName: pluginResult.displayName || pluginResult.username
  }
}

// ---------------------------------------------------------------------------

export {
  onExternalUserAuthenticated,
  getBypassFromExternalAuth,
  getAuthNameFromRefreshGrant,
  getBypassFromPasswordGrant
}
