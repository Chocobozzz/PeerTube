import * as express from 'express'
import { param, query } from 'express-validator'
import { checkJobState, checkJobType } from '../../helpers/custom-validators/jobs'
import { logger, loggerTagsFactory } from '../../helpers/logger'
import { areValidationErrors } from './utils'

const lTags = loggerTagsFactory('validators', 'jobs')

const listJobsValidator = [
  param('state')
  .optional()
  .custom(checkJobState),

  query('jobType')
    .optional()
    .custom(checkJobType),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listJobsValidator parameters.', { parameters: req.params, ...lTags() })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  listJobsValidator
}
