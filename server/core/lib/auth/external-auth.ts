import { UserAdminFlag, UserRole } from '@peertube/peertube-models'
import { isDevInstance } from '@peertube/peertube-node-utils'
import { exists } from '@server/helpers/custom-validators/misc.js'
import {
  isUserAdminFlagsValid,
  isUserDisplayNameValid,
  isUserLanguage,
  isUserRoleValid,
  isUserUsernameValid,
  isUserVideoQuotaDailyValid,
  isUserVideoQuotaValid
} from '@server/helpers/custom-validators/users.js'
import { createLogger } from '@server/helpers/logger.js'
import { generateRandomString } from '@server/helpers/utils.js'
import { PLUGIN_EXTERNAL_AUTH_TOKEN_LIFETIME } from '@server/initializers/constants.js'
import { PluginManager } from '@server/lib/plugins/plugin-manager.js'
import { OAuthTokenModel } from '@server/models/oauth/oauth-token.js'
import {
  RegisterServerAuthenticatedResult,
  RegisterServerAuthPassOptions,
  RegisterServerExternalAuthenticatedResult
} from '@server/types/plugins/register-server-auth.model.js'
import { Redis } from '../redis/index.js'
import { BypassLogin, UserUpdaterResults } from './bypass-login.model.js'
import { ExternalUser } from './external-user.model.js'
import { computeUserUpdaterResults } from './oauth-user.js'

const logger = createLogger()

/**
 * An external auth plugin authenticates the user on its own routes
 * PeerTube then redirects the user to the login page with a one time token, that the client exchanges for an OAuth token
 *
 * Several PeerTube processes can serve the platform and the reverse proxy does not send both requests to the same one
 */

type ExternalAuthTokenPayload = {
  // Timestamp in milliseconds
  expires: number

  user: ExternalUser
  userUpdaterResults?: UserUpdaterResults

  authName: string
  npmName: string
}

async function onExternalUserAuthenticated (options: {
  npmName: string
  authName: string
  authResult: RegisterServerExternalAuthenticatedResult
}) {
  const { npmName, authName } = options

  if (!options.authResult.req || !options.authResult.res) {
    logger.error('Cannot authenticate external user for auth %s of plugin %s: no req or res are provided.', authName, npmName)
    return
  }

  const authResult = sanitizeAuthResult(npmName, authName, { ...options.authResult })

  const { res, externalRedirectUri } = authResult

  if (!isAuthResultValid(npmName, authName, authResult)) {
    res.redirect('/login?externalAuthError=true')
    return
  }

  logger.info('Generating auth bypass token for %s in auth %s of plugin %s.', authResult.username, authName, npmName)

  const bypassToken = await generateRandomString(32)

  const expires = new Date()
  expires.setTime(expires.getTime() + PLUGIN_EXTERNAL_AUTH_TOKEN_LIFETIME)

  const user = buildUserResult(authResult)

  try {
    const userUpdaterResults = await computeUserUpdaterResults({
      pluginName: npmName,
      externalUser: user,
      userUpdater: authResult.userUpdater
    })

    const payload: ExternalAuthTokenPayload = { expires: expires.getTime(), user, npmName, authName, userUpdaterResults }

    await Redis.Instance.setExternalAuthToken(bypassToken, payload)
  } catch (err) {
    logger.error('Cannot generate auth bypass token for auth %s of plugin %s.', authName, npmName, { err })

    res.redirect('/login?externalAuthError=true')
    return
  }

  if (externalRedirectUri) {
    const url = new URL(externalRedirectUri)
    url.searchParams.set('externalAuthToken', bypassToken)
    url.searchParams.set('username', user.username)
    res.redirect(url.href)
  } else {
    const query = `externalAuthToken=${bypassToken}&username=${user.username}`

    if (isDevInstance() && process.env.ANGULAR_CLIENT_ENABLED === 'true') {
      res.redirect(`http://localhost:3000/login?${query}`)
    } else {
      res.redirect(`/login?${query}`)
    }
  }
}

async function getAuthNameFromRefreshGrant (refreshToken?: string) {
  if (!refreshToken) return undefined

  const tokenModel = await OAuthTokenModel.loadByRefreshToken(refreshToken)

  return tokenModel?.authName
}

async function getBypassFromPasswordGrant (username: string, password: string): Promise<BypassLogin> {
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
      authName,
      npmName,
      loginOptions.id,
      authOptions.getWeight()
    )

    let loginResult: RegisterServerAuthenticatedResult

    try {
      loginResult = await authOptions.login(loginOptions)
    } catch (err) {
      logger.error('Error in auth method %s of plugin %s', authName, npmName, { err })
      continue
    }

    if (!loginResult) continue
    if (!isAuthResultValid(npmName, authName, loginResult)) continue

    logger.info(
      'Login success with auth method %s of plugin %s for %s.',
      authName,
      npmName,
      loginOptions.id
    )

    const user = buildUserResult(loginResult)

    return {
      bypass: true,
      pluginName: npmName,
      authName,
      user,
      // Outside of the login error handling: an error of the plugin updater fails the login instead of trying the next auth method
      userUpdaterResults: await computeUserUpdaterResults({ pluginName: npmName, externalUser: user, userUpdater: loginResult.userUpdater })
    }
  }

  return undefined
}

async function consumeBypassFromExternalAuth (username: string, externalAuthToken: string): Promise<BypassLogin> {
  // Deleted when read, to prevent replaying the same token on any process
  const obj = await Redis.Instance.consumeExternalAuthToken<ExternalAuthTokenPayload>(externalAuthToken)
  if (!obj) throw new Error('Cannot authenticate user with unknown bypass token')

  const { expires, user, authName, npmName, userUpdaterResults } = obj

  if (Date.now() > expires) {
    throw new Error('Cannot authenticate user with an expired external auth token')
  }

  if (user.username !== username) {
    logger.error(`Cannot authenticate user ${user.username} with invalid username ${username}`)

    throw new Error(`Cannot authenticate user with invalid username ${username}`)
  }

  logger.info(
    'Auth success with external auth method %s of plugin %s for %s.',
    authName,
    npmName,
    user.email
  )

  return {
    bypass: true,
    pluginName: npmName,
    authName,
    userUpdaterResults,
    user
  }
}

function sanitizeAuthResult (npmName: string, authName: string, result: RegisterServerExternalAuthenticatedResult) {
  if (result.language && !isUserLanguage(result.language)) {
    logger.info(
      'Auth method ' + authName + ' of plugin ' + npmName + ' provided invalid language ' + result.language + ', setting it to null.'
    )
    result.language = null
  }

  return result
}

function isAuthResultValid (npmName: string, authName: string, result: RegisterServerAuthenticatedResult) {
  const returnError = (field: string) => {
    logger.error('Auth method %s of plugin %s did not provide a valid %s.', authName, npmName, field, { [field]: result[field] })
    return false
  }

  if (!isUserUsernameValid(result.username)) return returnError('username')
  if (!result.email) return returnError('email')

  // Following fields are optional
  // Empty string values are considered as not provided by the plugin: buildUserResult() falls back to a default
  if (exists(result.role) && !isUserRoleValid(result.role)) return returnError('role')
  if (result.displayName && !isUserDisplayNameValid(result.displayName)) return returnError('displayName')
  if (exists(result.adminFlags) && !isUserAdminFlagsValid(result.adminFlags)) return returnError('adminFlags')
  if (exists(result.videoQuota) && !isUserVideoQuotaValid(result.videoQuota + '')) return returnError('videoQuota')
  if (exists(result.videoQuotaDaily) && !isUserVideoQuotaDailyValid(result.videoQuotaDaily + '')) {
    return returnError('videoQuotaDaily')
  }
  if (result.language && !isUserLanguage(result.language)) return returnError('language')

  if (exists(result.userUpdater) && typeof result.userUpdater !== 'function') {
    logger.error('Auth method %s of plugin %s did not provide a valid user updater function.', authName, npmName)
    return false
  }

  if (result.externalId && (typeof result.externalId !== 'string' || result.externalId.length > 255)) {
    return returnError('externalId')
  }

  return true
}

function buildUserResult (pluginResult: RegisterServerAuthenticatedResult) {
  return {
    username: pluginResult.username,
    email: pluginResult.email,
    role: pluginResult.role ?? UserRole.USER,
    displayName: pluginResult.displayName || pluginResult.username,

    adminFlags: pluginResult.adminFlags ?? UserAdminFlag.NONE,

    videoQuota: pluginResult.videoQuota,
    videoQuotaDaily: pluginResult.videoQuotaDaily,

    language: pluginResult.language || null,

    externalId: pluginResult.externalId || undefined
  }
}

// ---------------------------------------------------------------------------

export {
  consumeBypassFromExternalAuth,
  getAuthNameFromRefreshGrant,
  getBypassFromPasswordGrant,
  onExternalUserAuthenticated
}
