import * as express from 'express'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  paginationValidator,
  setDefaultPagination,
  userHistoryRemoveValidator
} from '../../../middlewares'
import { getFormattedObjects } from '../../../helpers/utils'
import { UserVideoHistoryModel } from '../../../models/account/user-video-history'
import { sequelizeTypescript } from '../../../initializers/database'

const myVideosHistoryRouter = express.Router()

myVideosHistoryRouter.get('/me/history/videos',
  authenticate,
  paginationValidator,
  setDefaultPagination,
  asyncMiddleware(listMyVideosHistory)
)

myVideosHistoryRouter.post('/me/history/videos/remove',
  authenticate,
  userHistoryRemoveValidator,
  asyncRetryTransactionMiddleware(removeUserHistory)
)

// ---------------------------------------------------------------------------

export {
  myVideosHistoryRouter
}

// ---------------------------------------------------------------------------

async function listMyVideosHistory (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User

  const resultList = await UserVideoHistoryModel.listForApi(user, req.query.start, req.query.count)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function removeUserHistory (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User
  const beforeDate = req.body.beforeDate || null

  await sequelizeTypescript.transaction(t => {
    return UserVideoHistoryModel.removeUserHistoryBefore(user, beforeDate, t)
  })

  return res.type('json').status(204).end()
}
