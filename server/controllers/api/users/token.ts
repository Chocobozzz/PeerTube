import { handleLogin, handleTokenRevocation } from '@server/lib/auth'
import * as RateLimit from 'express-rate-limit'
import { CONFIG } from '@server/initializers/config'
import * as express from 'express'
import { Hooks } from '@server/lib/plugins/hooks'
import { asyncMiddleware, authenticate } from '@server/middlewares'

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

// ---------------------------------------------------------------------------

export {
  tokensRouter
}
// ---------------------------------------------------------------------------

function tokenSuccess (req: express.Request) {
  const username = req.body.username

  Hooks.runAction('action:api.user.oauth2-got-token', { username, ip: req.ip })
}
