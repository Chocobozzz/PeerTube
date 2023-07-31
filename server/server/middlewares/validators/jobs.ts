import express from 'express'
import { param, query } from 'express-validator'
import { isValidJobState, isValidJobType } from '../../helpers/custom-validators/jobs.js'
import { loggerTagsFactory } from '../../helpers/logger.js'
import { areValidationErrors } from './shared/index.js'

const lTags = loggerTagsFactory('validators', 'jobs')

const listJobsValidator = [
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

// ---------------------------------------------------------------------------

export {
  listJobsValidator
}
