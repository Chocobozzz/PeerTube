import { HttpStatusCode, Job, JobState, JobType, ResultList, UserRight } from '@peertube/peertube-models'
import { Job as BullJob } from 'bullmq'
import express from 'express'
import { isArray } from '../../helpers/custom-validators/misc.js'
import { JobQueue } from '../../lib/job-queue/index.js'
import {
  apiRateLimiter,
  asyncMiddleware,
  authenticate,
  ensureUserHasRight,
  jobsSortValidator,
  openapiOperationDoc,
  paginationValidatorBuilder,
  setDefaultPagination,
  setDefaultSort
} from '../../middlewares/index.js'
import { listJobsValidator } from '../../middlewares/validators/jobs.js'

const jobsRouter = express.Router()

jobsRouter.use(apiRateLimiter)

jobsRouter.post('/pause',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_JOBS),
  asyncMiddleware(pauseJobQueue)
)

jobsRouter.post('/resume',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_JOBS),
  resumeJobQueue
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

function resumeJobQueue (req: express.Request, res: express.Response) {
  JobQueue.Instance.resume()

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
  return {
    id: job.id,
    state: state || await job.getState(),
    type: job.queueName as JobType,
    data: job.data,
    parent: job.parent
      ? { id: job.parent.id }
      : undefined,
    progress: job.progress as number,
    priority: job.opts.priority,
    error: getJobError(job),
    createdAt: new Date(job.timestamp),
    finishedOn: new Date(job.finishedOn),
    processedOn: new Date(job.processedOn)
  }
}

function getJobError (job: BullJob) {
  if (isArray(job.stacktrace) && job.stacktrace.length !== 0) return job.stacktrace[0]
  if (job.failedReason) return job.failedReason

  return null
}
