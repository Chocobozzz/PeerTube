import * as express from 'express'
import { OAUTH_LIFETIME } from '@server/initializers/constants'
import * as OAuthServer from 'express-oauth-server'
import { PluginManager } from '@server/lib/plugins/plugin-manager'
import { RegisterServerAuthPassOptions } from '@shared/models/plugins/register-server-auth.model'
import { logger } from '@server/helpers/logger'
import { UserRole } from '@shared/models'
import { revokeToken } from '@server/lib/oauth-model'
import { OAuthTokenModel } from '@server/models/oauth/oauth-token'
import { isUserUsernameValid, isUserRoleValid, isUserDisplayNameValid } from '@server/helpers/custom-validators/users'

const oAuthServer = new OAuthServer({
  useErrorHandler: true,
  accessTokenLifetime: OAUTH_LIFETIME.ACCESS_TOKEN,
  refreshTokenLifetime: OAUTH_LIFETIME.REFRESH_TOKEN,
  continueMiddleware: true,
  model: require('./oauth-model')
})

function onExternalAuthPlugin (npmName: string, username: string, email: string) {

}

async function handleIdAndPassLogin (req: express.Request, res: express.Response, next: express.NextFunction) {
  const grantType = req.body.grant_type

  if (grantType === 'password') await proxifyPasswordGrant(req, res)
  else if (grantType === 'refresh_token') await proxifyRefreshGrant(req, res)

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

  return res.sendStatus(200)
}

// ---------------------------------------------------------------------------

export {
  oAuthServer,
  handleIdAndPassLogin,
  onExternalAuthPlugin,
  handleTokenRevocation
}

// ---------------------------------------------------------------------------

function forwardTokenReq (req: express.Request, res: express.Response, next: express.NextFunction) {
  return oAuthServer.token()(req, res, err => {
    if (err) {
      logger.warn('Login error.', { err })

      return res.status(err.status)
                .json({
                  error: err.message,
                  code: err.name
                })
                .end()
    }

    return next()
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
      if (loginResult) {
        logger.info(
          'Login success with auth method %s of plugin %s for %s.',
          authName, npmName, loginOptions.id
        )

        if (!isUserUsernameValid(loginResult.username)) {
          logger.error('Auth method %s of plugin %s did not provide a valid username.', authName, npmName, { loginResult })
          continue
        }

        if (!loginResult.email) {
          logger.error('Auth method %s of plugin %s did not provide a valid email.', authName, npmName, { loginResult })
          continue
        }

        // role is optional
        if (loginResult.role && !isUserRoleValid(loginResult.role)) {
          logger.error('Auth method %s of plugin %s did not provide a valid role.', authName, npmName, { loginResult })
          continue
        }

        // display name is optional
        if (loginResult.displayName && !isUserDisplayNameValid(loginResult.displayName)) {
          logger.error('Auth method %s of plugin %s did not provide a valid display name.', authName, npmName, { loginResult })
          continue
        }

        res.locals.bypassLogin = {
          bypass: true,
          pluginName: pluginAuth.npmName,
          authName: authOptions.authName,
          user: {
            username: loginResult.username,
            email: loginResult.email,
            role: loginResult.role || UserRole.USER,
            displayName: loginResult.displayName || loginResult.username
          }
        }

        return
      }
    } catch (err) {
      logger.error('Error in auth method %s of plugin %s', authOptions.authName, pluginAuth.npmName, { err })
    }
  }
}
