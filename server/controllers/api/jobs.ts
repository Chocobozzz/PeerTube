import * as express from 'express'
import { ResultList } from '../../../shared'
import { Job, JobType, JobState } from '../../../shared/models'
import { UserRight } from '../../../shared/models/users'
import { JobQueue } from '../../lib/job-queue'
import {
  asyncMiddleware,
  authenticate,
  ensureUserHasRight,
  jobsSortValidator,
  setDefaultPagination,
  setDefaultSort
} from '../../middlewares'
import { paginationValidator } from '../../middlewares/validators'
import { listJobsValidator } from '../../middlewares/validators/jobs'

const jobsRouter = express.Router()

jobsRouter.get('/:state',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_JOBS),
  paginationValidator,
  jobsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listJobsValidator),
  asyncMiddleware(listJobs)
)

// ---------------------------------------------------------------------------

export {
  jobsRouter
}

// ---------------------------------------------------------------------------

async function listJobs (req: express.Request, res: express.Response, next: express.NextFunction) {
  const sort = req.query.sort === 'createdAt' ? 'ASC' : 'DESC'

  const jobs = await JobQueue.Instance.listForApi(req.params.state, req.query.start, req.query.count, sort)
  const total = await JobQueue.Instance.count(req.params.state)

  const result: ResultList<any> = {
    total,
    data: jobs.map(j => formatJob(j.toJSON()))
  }
  return res.json(result)
}

function formatJob (job: any): Job {
  return {
    id: job.id,
    state: job.state as JobState,
    type: job.type as JobType,
    data: job.data,
    error: job.error,
    createdAt: new Date(parseInt(job.created_at, 10)),
    updatedAt: new Date(parseInt(job.updated_at, 10))
  }
}
