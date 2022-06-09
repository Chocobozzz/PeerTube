import * as express from 'express'
import * as RateLimit from 'express-rate-limit'
import { logger } from '@server/helpers/logger'
import { buildUUID } from '@server/helpers/uuid'
import { CONFIG } from '@server/initializers/config'
import { getAuthNameFromRefreshGrant, getBypassFromExternalAuth, getBypassFromPasswordGrant } from '@server/lib/auth/external-auth'
import { handleOAuthToken } from '@server/lib/auth/oauth'
import { BypassLogin, revokeToken } from '@server/lib/auth/oauth-model'
import { Hooks } from '@server/lib/plugins/hooks'
import { asyncMiddleware, authenticate, openapiOperationDoc } from '@server/middlewares'
import { ScopedToken } from '@shared/models/users/user-scoped-token'

const tokensRouter = express.Router()

const loginRateLimiter = RateLimit({
  windowMs: CONFIG.RATES_LIMIT.LOGIN.WINDOW_MS,
  max: CONFIG.RATES_LIMIT.LOGIN.MAX
})

tokensRouter.post('/token',
  loginRateLimiter,
  openapiOperationDoc({ operationId: 'getOAuthToken' }),
  asyncMiddleware(handleToken)
)

tokensRouter.post('/revoke-token',
  openapiOperationDoc({ operationId: 'revokeOAuthToken' }),
  authenticate,
  asyncMiddleware(handleTokenRevocation)
)

tokensRouter.get('/scoped-tokens',
  authenticate,
  getScopedTokens
)

tokensRouter.post('/scoped-tokens',
  authenticate,
  asyncMiddleware(renewScopedTokens)
)

// ---------------------------------------------------------------------------

export {
  tokensRouter
}
// ---------------------------------------------------------------------------

async function handleToken (req: express.Request, res: express.Response, next: express.NextFunction) {
  const grantType = req.body.grant_type

  try {
    const bypassLogin = await buildByPassLogin(req, grantType)

    const refreshTokenAuthName = grantType === 'refresh_token'
      ? await getAuthNameFromRefreshGrant(req.body.refresh_token)
      : undefined

    const options = {
      refreshTokenAuthName,
      bypassLogin
    }

    const token = await handleOAuthToken(req, options)

    res.set('Cache-Control', 'no-store')
    res.set('Pragma', 'no-cache')

    Hooks.runAction('action:api.user.oauth2-got-token', { username: token.user.username, ip: req.ip })

    return res.json({
      token_type: 'Bearer',

      access_token: token.accessToken,
      refresh_token: token.refreshToken,

      expires_in: token.accessTokenExpiresIn,
      refresh_token_expires_in: token.refreshTokenExpiresIn
    })
  } catch (err) {
    logger.warn('Login error', { err })

    return res.fail({
      status: err.code,
      message: err.message,
      type: err.name
    })
  }
}

async function handleTokenRevocation (req: express.Request, res: express.Response) {
  const token = res.locals.oauth.token

  const result = await revokeToken(token, { req, explicitLogout: true })

  return res.json(result)
}

function getScopedTokens (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.user

  return res.json({
    feedToken: user.feedToken
  } as ScopedToken)
}

async function renewScopedTokens (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.user

  user.feedToken = buildUUID()
  await user.save()

  return res.json({
    feedToken: user.feedToken
  } as ScopedToken)
}

async function buildByPassLogin (req: express.Request, grantType: string): Promise<BypassLogin> {
  if (grantType !== 'password') return undefined

  if (req.body.externalAuthToken) {
    // Consistency with the getBypassFromPasswordGrant promise
    return getBypassFromExternalAuth(req.body.username, req.body.externalAuthToken)
  }

  return getBypassFromPasswordGrant(req.body.username, req.body.password)
}
