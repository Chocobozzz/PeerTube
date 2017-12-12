import * as express from 'express'
import { UserRight } from '../../../shared/models/users'
import { getFormattedObjects } from '../../helpers'
import { asyncMiddleware, authenticate, ensureUserHasRight, jobsSortValidator, setJobsSort, setPagination } from '../../middlewares'
import { paginationValidator } from '../../middlewares/validators'
import { JobModel } from '../../models/job/job'

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
  const resultList = await JobModel.listForApi(req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}
