import express from 'express'
import { HttpStatusCode } from '../../../../shared/models/http/http-error-codes'
import { getFormattedObjects } from '../../../helpers/utils'
import { sequelizeTypescript } from '../../../initializers/database'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  paginationValidator,
  setDefaultPagination,
  userHistoryListValidator,
  userHistoryRemoveValidator
} from '../../../middlewares'
import { UserVideoHistoryModel } from '../../../models/user/user-video-history'

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
