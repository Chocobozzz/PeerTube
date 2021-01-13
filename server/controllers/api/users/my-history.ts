import * as express from 'express'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  paginationValidator,
  setDefaultPagination,
  userHistoryListValidator,
  userHistoryRemoveValidator
} from '../../../middlewares'
import { getFormattedObjects } from '../../../helpers/utils'
import { UserVideoHistoryModel } from '../../../models/account/user-video-history'
import { sequelizeTypescript } from '../../../initializers/database'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'

const myVideosHistoryRouter = express.Router()

myVideosHistoryRouter.get('/me/history/videos',
  authenticate,
  paginationValidator,
  setDefaultPagination,
  userHistoryListValidator,
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

  const resultList = await UserVideoHistoryModel.listForApi(user, req.query.start, req.query.count, req.query.search)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function removeUserHistory (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User
  const beforeDate = req.body.beforeDate || null

  await sequelizeTypescript.transaction(t => {
    return UserVideoHistoryModel.removeUserHistoryBefore(user, beforeDate, t)
  })

  return res.type('json')
            .status(HttpStatusCode.NO_CONTENT_204)
            .end()
}
