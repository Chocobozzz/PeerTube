import { HttpStatusCode, JobType } from '@peertube/peertube-models'
import express from 'express'
import { param, query } from 'express-validator'
import { isValidJobState, isValidJobType } from '../../helpers/custom-validators/jobs.js'
import { loggerTagsFactory } from '../../helpers/logger.js'
import { JobQueue } from '../../lib/job-queue/index.js'
import { areValidationErrors } from './shared/index.js'

const lTags = loggerTagsFactory('validators', 'jobs')

export const listJobsValidator = [
  param('state')
    .optional()
    .custom(isValidJobState),

  query('jobType')
    .optional()
    .custom(isValidJobType),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res, lTags())) return

    return next()
  }
]

export const cancelJobValidator = [
  param('jobType').custom(isValidJobType),
  param('jobId').isString().not().isEmpty(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res, lTags())) return

    const jobType = req.params.jobType as JobType
    const jobId = req.params.jobId

    const job = await JobQueue.Instance.getJob(jobType, jobId)
    if (!job) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    if (!await JobQueue.Instance.canCancelJob(job.queueName as JobType, job)) {
      return res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: req.t(`This job cannot be cancelled`)
      })
    }

    res.locals.job = job

    return next()
  }
]
