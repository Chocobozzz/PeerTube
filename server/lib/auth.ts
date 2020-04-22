import * as express from 'express'
import { OAUTH_LIFETIME } from '@server/initializers/constants'
import * as OAuthServer from 'express-oauth-server'
import { PluginManager } from '@server/lib/plugins/plugin-manager'
import { RegisterServerAuthPassOptions } from '@shared/models/plugins/register-server-auth.model'
import { logger } from '@server/helpers/logger'
import { UserRole } from '@shared/models'

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

    if (aWeight === bWeight) return 0
    if (aWeight > bWeight) return 1
    return -1
  })

  const loginOptions = {
    id: req.body.username,
    password: req.body.password
  }

  for (const pluginAuth of pluginAuths) {
    logger.debug(
      'Using auth method of %s to login %s with weight %d.',
      pluginAuth.npmName, loginOptions.id, pluginAuth.registerAuthOptions.getWeight()
    )

    const loginResult = await pluginAuth.registerAuthOptions.login(loginOptions)
    if (loginResult) {
      logger.info('Login success with plugin %s for %s.', pluginAuth.npmName, loginOptions.id)

      res.locals.bypassLogin = {
        bypass: true,
        pluginName: pluginAuth.npmName,
        user: {
          username: loginResult.username,
          email: loginResult.email,
          role: loginResult.role || UserRole.USER,
          displayName: loginResult.displayName || loginResult.username
        }
      }

      break
    }
  }

  return localLogin(req, res, next)
}

// ---------------------------------------------------------------------------

export {
  oAuthServer,
  handleIdAndPassLogin,
  onExternalAuthPlugin
}

// ---------------------------------------------------------------------------

function localLogin (req: express.Request, res: express.Response, next: express.NextFunction) {
  return oAuthServer.token()(req, res, err => {
    if (err) {
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
