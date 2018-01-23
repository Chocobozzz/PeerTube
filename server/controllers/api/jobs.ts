import * as express from 'express'
import { UserRight } from '../../../shared/models/users'
import { getFormattedObjects } from '../../helpers/utils'
import {
  asyncMiddleware, authenticate, ensureUserHasRight, jobsSortValidator, setDefaultPagination,
  setDefaultSort
} from '../../middlewares'
import { paginationValidator } from '../../middlewares/validators'
import { JobModel } from '../../models/job/job'

const jobsRouter = express.Router()

/**
 *
 * @api {get} /jobs Get a list of jobs
 * @apiName GetJobs
 * @apiGroup Job
 * @apiVersion  1.0.0
 *
 * @apiSuccessExample {json} Success-Response:
 *  [
 *    {
 *      id: number,
 *      state: string,
 *      category: string,
 *      handlerName: string,
 *      handlerInputData: string[],
 *      createdAt: Date | string,
 *      updatedAt: Date | string
 *    },
 *    ...
 *  ]
 *
 */
jobsRouter.get('/',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_JOBS),
  paginationValidator,
  jobsSortValidator,
  setDefaultSort,
  setDefaultPagination,
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
