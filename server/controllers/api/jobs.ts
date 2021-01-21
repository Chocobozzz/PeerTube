import * as express from 'express'
import { ResultList } from '../../../shared'
import { Job, JobState, JobType } from '../../../shared/models'
import { UserRight } from '../../../shared/models/users'
import { isArray } from '../../helpers/custom-validators/misc'
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

jobsRouter.get('/:state?',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_JOBS),
  paginationValidator,
  jobsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  listJobsValidator,
  asyncMiddleware(listJobs)
)

// ---------------------------------------------------------------------------

export {
  jobsRouter
}

// ---------------------------------------------------------------------------

async function listJobs (req: express.Request, res: express.Response) {
  const state = req.params.state as JobState
  const asc = req.query.sort === 'createdAt'
  const jobType = req.query.jobType

  const jobs = await JobQueue.Instance.listForApi({
    state,
    start: req.query.start,
    count: req.query.count,
    asc,
    jobType
  })
  const total = await JobQueue.Instance.count(state, jobType)

  const result: ResultList<Job> = {
    total,
    data: await Promise.all(jobs.map(j => formatJob(j, state)))
  }

  return res.json(result)
}

async function formatJob (job: any, state?: JobState): Promise<Job> {
  const error = isArray(job.stacktrace) && job.stacktrace.length !== 0
    ? job.stacktrace[0]
    : null

  return {
    id: job.id,
    state: state || await job.getState(),
    type: job.queue.name as JobType,
    data: job.data,
    progress: await job.progress(),
    priority: job.opts.priority,
    error,
    createdAt: new Date(job.timestamp),
    finishedOn: new Date(job.finishedOn),
    processedOn: new Date(job.processedOn)
  }
}
