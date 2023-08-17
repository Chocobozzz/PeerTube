import express from 'express'
import { forceNumber } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import { getFormattedObjects } from '../../../helpers/utils.js'
import { sequelizeTypescript } from '../../../initializers/database.js'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  paginationValidator,
  setDefaultPagination,
  userHistoryListValidator,
  userHistoryRemoveAllValidator,
  userHistoryRemoveElementValidator
} from '../../../middlewares/index.js'
import { UserVideoHistoryModel } from '../../../models/user/user-video-history.js'

const myVideosHistoryRouter = express.Router()

myVideosHistoryRouter.get('/me/history/videos',
  authenticate,
  paginationValidator,
  setDefaultPagination,
  userHistoryListValidator,
  asyncMiddleware(listMyVideosHistory)
)

myVideosHistoryRouter.delete('/me/history/videos/:videoId',
  authenticate,
  userHistoryRemoveElementValidator,
  asyncMiddleware(removeUserHistoryElement)
)

myVideosHistoryRouter.post('/me/history/videos/remove',
  authenticate,
  userHistoryRemoveAllValidator,
  asyncRetryTransactionMiddleware(removeAllUserHistory)
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

async function removeUserHistoryElement (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User

  await UserVideoHistoryModel.removeUserHistoryElement(user, forceNumber(req.params.videoId))

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function removeAllUserHistory (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User
  const beforeDate = req.body.beforeDate || null

  await sequelizeTypescript.transaction(t => {
    return UserVideoHistoryModel.removeUserHistoryBefore(user, beforeDate, t)
  })

  return res.type('json')
            .status(HttpStatusCode.NO_CONTENT_204)
            .end()
}
