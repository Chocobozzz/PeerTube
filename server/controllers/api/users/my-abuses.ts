import * as express from 'express'
import { AbuseModel } from '@server/models/abuse/abuse'
import {
  abuseListForUserValidator,
  abusesSortValidator,
  asyncMiddleware,
  authenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort
} from '../../../middlewares'

const myAbusesRouter = express.Router()

myAbusesRouter.get('/me/abuses',
  authenticate,
  paginationValidator,
  abusesSortValidator,
  setDefaultSort,
  setDefaultPagination,
  abuseListForUserValidator,
  asyncMiddleware(listMyAbuses)
)

// ---------------------------------------------------------------------------

export {
  myAbusesRouter
}

// ---------------------------------------------------------------------------

async function listMyAbuses (req: express.Request, res: express.Response) {
  const resultList = await AbuseModel.listForUserApi({
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    id: req.query.id,
    search: req.query.search,
    state: req.query.state,
    user: res.locals.oauth.token.User
  })

  return res.json({
    total: resultList.total,
    data: resultList.data.map(d => d.toFormattedUserJSON())
  })
}
