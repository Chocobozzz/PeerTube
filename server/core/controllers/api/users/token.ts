import { ResultList, ScopedToken, TokenSession } from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { OTP } from '@server/initializers/constants.js'
import { getAuthNameFromRefreshGrant, getBypassFromExternalAuth, getBypassFromPasswordGrant } from '@server/lib/auth/external-auth.js'
import { BypassLogin, revokeToken } from '@server/lib/auth/oauth-model.js'
import { handleOAuthToken, MissingTwoFactorError } from '@server/lib/auth/oauth.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import {
  asyncMiddleware,
  authenticate,
  buildRateLimiter,
  openapiOperationDoc,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  tokenSessionsSortValidator
} from '@server/middlewares/index.js'
import { manageTokenSessionsValidator, revokeTokenSessionValidator } from '@server/middlewares/validators/token.js'
import { OAuthTokenModel } from '@server/models/oauth/oauth-token.js'
import express from 'express'

const tokensRouter = express.Router()

const loginRateLimiter = buildRateLimiter({
  windowMs: CONFIG.RATES_LIMIT.LOGIN.WINDOW_MS,
  max: CONFIG.RATES_LIMIT.LOGIN.MAX
})

tokensRouter.post(
  '/token',
  loginRateLimiter,
  openapiOperationDoc({ operationId: 'getOAuthToken' }),
  asyncMiddleware(handleToken)
)

tokensRouter.post(
  '/revoke-token',
  openapiOperationDoc({ operationId: 'revokeOAuthToken' }),
  authenticate,
  asyncMiddleware(handleTokenRevocation)
)

// ---------------------------------------------------------------------------

tokensRouter.get(
  '/:userId/token-sessions',
  authenticate,
  asyncMiddleware(manageTokenSessionsValidator),
  paginationValidator,
  tokenSessionsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listTokenSessions)
)

tokensRouter.post(
  '/:userId/token-sessions/:tokenSessionId/revoke',
  authenticate,
  asyncMiddleware(manageTokenSessionsValidator),
  asyncMiddleware(revokeTokenSessionValidator),
  asyncMiddleware(revokeTokenSession)
)

// ---------------------------------------------------------------------------

tokensRouter.get(
  '/scoped-tokens',
  authenticate,
  getScopedTokens
)

tokensRouter.post(
  '/scoped-tokens',
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

    Hooks.runAction('action:api.user.oauth2-got-token', { username: token.user.username, ip: req.ip, req, res })

    return res.json({
      token_type: 'Bearer',

      access_token: token.accessToken,
      refresh_token: token.refreshToken,

      expires_in: token.accessTokenExpiresIn,
      refresh_token_expires_in: token.refreshTokenExpiresIn
    })
  } catch (err) {
    if (err instanceof MissingTwoFactorError) {
      res.set(OTP.HEADER_NAME, OTP.HEADER_REQUIRED_VALUE)
      logger.debug('Missing two factor error', { err })
    } else {
      logger.warn('Login error', { err })
    }

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

// ---------------------------------------------------------------------------

async function listTokenSessions (req: express.Request, res: express.Response) {
  const currentToken = res.locals.oauth.token

  const { total, data } = await OAuthTokenModel.listSessionsOf({
    start: req.query.start as number,
    count: req.query.count as number,
    sort: req.query.sort as string,
    userId: res.locals.user.id
  })

  return res.json(
    {
      total,
      data: data.map(session => session.toSessionFormattedJSON(currentToken.accessToken))
    } satisfies ResultList<TokenSession>
  )
}

async function revokeTokenSession (req: express.Request, res: express.Response) {
  const token = res.locals.tokenSession

  const result = await revokeToken(token, { req, explicitLogout: true })

  return res.json(result)
}

// ---------------------------------------------------------------------------

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
