import { handleLogin, handleTokenRevocation } from '@server/lib/auth'
import * as RateLimit from 'express-rate-limit'
import { CONFIG } from '@server/initializers/config'
import * as express from 'express'
import { Hooks } from '@server/lib/plugins/hooks'
import { asyncMiddleware, authenticate } from '@server/middlewares'
import { ScopedToken } from '@shared/models/users/user-scoped-token'
import { v4 as uuidv4 } from 'uuid'

const tokensRouter = express.Router()

const loginRateLimiter = RateLimit({
  windowMs: CONFIG.RATES_LIMIT.LOGIN.WINDOW_MS,
  max: CONFIG.RATES_LIMIT.LOGIN.MAX
})

tokensRouter.post('/token',
  loginRateLimiter,
  handleLogin,
  tokenSuccess
)

tokensRouter.post('/revoke-token',
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

function tokenSuccess (req: express.Request) {
  const username = req.body.username

  Hooks.runAction('action:api.user.oauth2-got-token', { username, ip: req.ip })
}

function getScopedTokens (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.user

  return res.json({
    feedToken: user.feedToken
  } as ScopedToken)
}

async function renewScopedTokens (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.user

  user.feedToken = uuidv4()
  await user.save()

  return res.json({
    feedToken: user.feedToken
  } as ScopedToken)
}
