import express from 'express'
import { ServerConfigManager } from '@server/lib/server-config-manager.js'
import { ActorCustomPageModel } from '@server/models/account/actor-custom-page.js'
import { HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { apiRateLimiter, asyncMiddleware, authenticate, ensureUserHasRight } from '../../middlewares/index.js'

const customPageRouter = express.Router()

customPageRouter.use(apiRateLimiter)

customPageRouter.get('/homepage/instance',
  asyncMiddleware(getInstanceHomepage)
)

customPageRouter.put('/homepage/instance',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_INSTANCE_CUSTOM_PAGE),
  asyncMiddleware(updateInstanceHomepage)
)

// ---------------------------------------------------------------------------

export {
  customPageRouter
}

// ---------------------------------------------------------------------------

async function getInstanceHomepage (req: express.Request, res: express.Response) {
  const page = await ActorCustomPageModel.loadInstanceHomepage()
  if (!page) {
    return res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Instance homepage could not be found'
    })
  }

  return res.json(page.toFormattedJSON())
}

async function updateInstanceHomepage (req: express.Request, res: express.Response) {
  const content = req.body.content

  await ActorCustomPageModel.updateInstanceHomepage(content)
  ServerConfigManager.Instance.updateHomepageState(content)

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}
