import * as express from 'express'
import { getFormattedObjects } from '../../helpers'
import { getApplicationAccount } from '../../helpers/utils'
import { database as db } from '../../initializers/database'
import { asyncMiddleware, paginationValidator, setFollowersSort, setPagination } from '../../middlewares'
import { setFollowingSort } from '../../middlewares/sort'
import { followersSortValidator, followingSortValidator } from '../../middlewares/validators/sort'

const podsRouter = express.Router()

podsRouter.get('/following',
  paginationValidator,
  followingSortValidator,
  setFollowingSort,
  setPagination,
  asyncMiddleware(listFollowing)
)

podsRouter.get('/followers',
  paginationValidator,
  followersSortValidator,
  setFollowersSort,
  setPagination,
  asyncMiddleware(listFollowers)
)

// ---------------------------------------------------------------------------

export {
  podsRouter
}

// ---------------------------------------------------------------------------

async function listFollowing (req: express.Request, res: express.Response, next: express.NextFunction) {
  const applicationAccount = await getApplicationAccount()
  const resultList = await db.Account.listFollowingForApi(applicationAccount.id, req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listFollowers (req: express.Request, res: express.Response, next: express.NextFunction) {
  const applicationAccount = await getApplicationAccount()
  const resultList = await db.Account.listFollowersForApi(applicationAccount.id, req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}
