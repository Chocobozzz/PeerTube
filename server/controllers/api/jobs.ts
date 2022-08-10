import { Job as BullJob } from 'bullmq'
import express from 'express'
import { HttpStatusCode, Job, JobState, JobType, ResultList, UserRight } from '@shared/models'
import { isArray } from '../../helpers/custom-validators/misc'
import { JobQueue } from '../../lib/job-queue'
import {
  asyncMiddleware,
  authenticate,
  ensureUserHasRight,
  jobsSortValidator,
  openapiOperationDoc,
  paginationValidatorBuilder,
  setDefaultPagination,
  setDefaultSort
} from '../../middlewares'
import { listJobsValidator } from '../../middlewares/validators/jobs'

const jobsRouter = express.Router()

jobsRouter.post('/pause',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_JOBS),
  asyncMiddleware(pauseJobQueue)
)

jobsRouter.post('/resume',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_JOBS),
  asyncMiddleware(resumeJobQueue)
)

jobsRouter.get('/:state?',
  openapiOperationDoc({ operationId: 'getJobs' }),
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_JOBS),
  paginationValidatorBuilder([ 'jobs' ]),
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

async function pauseJobQueue (req: express.Request, res: express.Response) {
  await JobQueue.Instance.pause()

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function resumeJobQueue (req: express.Request, res: express.Response) {
  await JobQueue.Instance.resume()

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

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

async function formatJob (job: BullJob, state?: JobState): Promise<Job> {
  const error = isArray(job.stacktrace) && job.stacktrace.length !== 0
    ? job.stacktrace[0]
    : null

  return {
    id: job.id,
    state: state || await job.getState(),
    type: job.queueName as JobType,
    data: job.data,
    progress: job.progress as number,
    priority: job.opts.priority,
    error,
    createdAt: new Date(job.timestamp),
    finishedOn: new Date(job.finishedOn),
    processedOn: new Date(job.processedOn)
  }
}
