import * as express from 'express'
import { getFormattedObjects } from '../../helpers'
import { database as db } from '../../initializers/database'
import { asyncMiddleware, paginationValidator, podsSortValidator, setPagination, setPodsSort } from '../../middlewares'

const podsRouter = express.Router()

podsRouter.get('/',
  paginationValidator,
  podsSortValidator,
  setPodsSort,
  setPagination,
  asyncMiddleware(listPods)
)

// ---------------------------------------------------------------------------

export {
  podsRouter
}

// ---------------------------------------------------------------------------

async function listPods (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await db.Pod.listForApi(req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}
