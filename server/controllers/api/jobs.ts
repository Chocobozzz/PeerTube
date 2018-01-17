import * as express from 'express'
import { UserRight } from '../../../shared/models/users'
import { getFormattedObjects } from '../../helpers/utils'
import { asyncMiddleware, authenticate, ensureUserHasRight, jobsSortValidator, setDefaultSort, setPagination } from '../../middlewares'
import { paginationValidator } from '../../middlewares/validators'
import { JobModel } from '../../models/job/job'

const jobsRouter = express.Router()

jobsRouter.get('/',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_JOBS),
  paginationValidator,
  jobsSortValidator,
  setDefaultSort,
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
