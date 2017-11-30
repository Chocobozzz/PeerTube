import * as express from 'express'
import { asyncMiddleware, jobsSortValidator, setJobsSort, setPagination } from '../../middlewares'
import { paginationValidator } from '../../middlewares/validators/pagination'
import { database as db } from '../../initializers'
import { getFormattedObjects } from '../../helpers/utils'
import { authenticate } from '../../middlewares/oauth'
import { ensureUserHasRight } from '../../middlewares/user-right'
import { UserRight } from '../../../shared/models/users/user-right.enum'

const jobsRouter = express.Router()

jobsRouter.get('/',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_JOBS),
  paginationValidator,
  jobsSortValidator,
  setJobsSort,
  setPagination,
  asyncMiddleware(listJobs)
)

// ---------------------------------------------------------------------------

export {
  jobsRouter
}

// ---------------------------------------------------------------------------

async function listJobs (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await db.Job.listForApi(req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}
