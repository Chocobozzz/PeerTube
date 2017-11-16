// Intercept ActivityPub client requests
import * as express from 'express'

import { database as db } from '../../initializers'
import { executeIfActivityPub, localAccountValidator } from '../../middlewares'
import { pageToStartAndCount } from '../../helpers'
import { AccountInstance } from '../../models'
import { activityPubCollectionPagination } from '../../helpers/activitypub'
import { ACTIVITY_PUB } from '../../initializers/constants'
import { asyncMiddleware } from '../../middlewares/async'

const activityPubClientRouter = express.Router()

activityPubClientRouter.get('/account/:name',
  executeIfActivityPub(localAccountValidator),
  executeIfActivityPub(asyncMiddleware(accountController))
)

activityPubClientRouter.get('/account/:name/followers',
  executeIfActivityPub(localAccountValidator),
  executeIfActivityPub(asyncMiddleware(accountFollowersController))
)

activityPubClientRouter.get('/account/:name/following',
  executeIfActivityPub(localAccountValidator),
  executeIfActivityPub(asyncMiddleware(accountFollowingController))
)

// ---------------------------------------------------------------------------

export {
  activityPubClientRouter
}

// ---------------------------------------------------------------------------

async function accountController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountInstance = res.locals.account

  return res.json(account.toActivityPubObject()).end()
}

async function accountFollowersController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountInstance = res.locals.account

  const page = req.params.page || 1
  const { start, count } = pageToStartAndCount(page, ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE)

  const result = await db.AccountFollow.listAcceptedFollowerUrlsForApi([ account.id ], start, count)
  const activityPubResult = activityPubCollectionPagination(req.url, page, result)

  return res.json(activityPubResult)
}

async function accountFollowingController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountInstance = res.locals.account

  const page = req.params.page || 1
  const { start, count } = pageToStartAndCount(page, ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE)

  const result = await db.AccountFollow.listAcceptedFollowingUrlsForApi([ account.id ], start, count)
  const activityPubResult = activityPubCollectionPagination(req.url, page, result)

  return res.json(activityPubResult)
}
