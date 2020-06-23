import { isUserDisplayNameValid, isUserRoleValid, isUserUsernameValid } from '@server/helpers/custom-validators/users'
import { logger } from '@server/helpers/logger'
import { generateRandomString } from '@server/helpers/utils'
import { OAUTH_LIFETIME, PLUGIN_EXTERNAL_AUTH_TOKEN_LIFETIME } from '@server/initializers/constants'
import { revokeToken } from '@server/lib/oauth-model'
import { PluginManager } from '@server/lib/plugins/plugin-manager'
import { OAuthTokenModel } from '@server/models/oauth/oauth-token'
import { UserRole } from '@shared/models'
import {
  RegisterServerAuthenticatedResult,
  RegisterServerAuthPassOptions,
  RegisterServerExternalAuthenticatedResult
} from '@server/types/plugins/register-server-auth.model'
import * as express from 'express'
import * as OAuthServer from 'express-oauth-server'

const oAuthServer = new OAuthServer({
  useErrorHandler: true,
  accessTokenLifetime: OAUTH_LIFETIME.ACCESS_TOKEN,
  refreshTokenLifetime: OAUTH_LIFETIME.REFRESH_TOKEN,
  continueMiddleware: true,
  model: require('./oauth-model')
})

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

async function handleLogin (req: express.Request, res: express.Response, next: express.NextFunction) {
  const grantType = req.body.grant_type

  if (grantType === 'password') {
    if (req.body.externalAuthToken) proxifyExternalAuthBypass(req, res)
    else await proxifyPasswordGrant(req, res)
  } else if (grantType === 'refresh_token') {
    await proxifyRefreshGrant(req, res)
  }

  return forwardTokenReq(req, res, next)
}

async function handleTokenRevocation (req: express.Request, res: express.Response) {
  const token = res.locals.oauth.token

  res.locals.explicitLogout = true
  await revokeToken(token)

  // FIXME: uncomment when https://github.com/oauthjs/node-oauth2-server/pull/289 is released
  // oAuthServer.revoke(req, res, err => {
  //   if (err) {
  //     logger.warn('Error in revoke token handler.', { err })
  //
  //     return res.status(err.status)
  //               .json({
  //                 error: err.message,
  //                 code: err.name
  //               })
  //               .end()
  //   }
  // })

  return res.json()
}

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

  // Cleanup
  const now = new Date()
  for (const [ key, value ] of authBypassTokens) {
    if (value.expires.getTime() < now.getTime()) {
      authBypassTokens.delete(key)
    }
  }

  res.redirect(`/login?externalAuthToken=${bypassToken}&username=${user.username}`)
}

// ---------------------------------------------------------------------------

export { oAuthServer, handleLogin, onExternalUserAuthenticated, handleTokenRevocation }

// ---------------------------------------------------------------------------

function forwardTokenReq (req: express.Request, res: express.Response, next?: express.NextFunction) {
  return oAuthServer.token()(req, res, err => {
    if (err) {
      logger.warn('Login error.', { err })

      return res.status(err.status)
        .json({
          error: err.message,
          code: err.name
        })
    }

    if (next) return next()
  })
}

async function proxifyRefreshGrant (req: express.Request, res: express.Response) {
  const refreshToken = req.body.refresh_token
  if (!refreshToken) return

  const tokenModel = await OAuthTokenModel.loadByRefreshToken(refreshToken)
  if (tokenModel?.authName) res.locals.refreshTokenAuthName = tokenModel.authName
}

async function proxifyPasswordGrant (req: express.Request, res: express.Response) {
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
    id: req.body.username,
    password: req.body.password
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

      res.locals.bypassLogin = {
        bypass: true,
        pluginName: pluginAuth.npmName,
        authName: authOptions.authName,
        user: buildUserResult(loginResult)
      }

      return
    } catch (err) {
      logger.error('Error in auth method %s of plugin %s', authOptions.authName, pluginAuth.npmName, { err })
    }
  }
}

function proxifyExternalAuthBypass (req: express.Request, res: express.Response) {
  const obj = authBypassTokens.get(req.body.externalAuthToken)
  if (!obj) {
    logger.error('Cannot authenticate user with unknown bypass token')
    return res.sendStatus(400)
  }

  const { expires, user, authName, npmName } = obj

  const now = new Date()
  if (now.getTime() > expires.getTime()) {
    logger.error('Cannot authenticate user with an expired external auth token')
    return res.sendStatus(400)
  }

  if (user.username !== req.body.username) {
    logger.error('Cannot authenticate user %s with invalid username %s.', req.body.username)
    return res.sendStatus(400)
  }

  // Bypass oauth library validation
  req.body.password = 'fake'

  logger.info(
    'Auth success with external auth method %s of plugin %s for %s.',
    authName, npmName, user.email
  )

  res.locals.bypassLogin = {
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
