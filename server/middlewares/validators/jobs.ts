import * as express from 'express'
import { param, query } from 'express-validator'
import { isValidJobState, isValidJobType } from '../../helpers/custom-validators/jobs'
import { logger, loggerTagsFactory } from '../../helpers/logger'
import { areValidationErrors } from './shared'

const lTags = loggerTagsFactory('validators', 'jobs')

const listJobsValidator = [
  param('state')
  .optional()
  .custom(isValidJobState).not().isEmpty().withMessage('Should have a valid job state'),

  query('jobType')
    .optional()
    .custom(isValidJobType).withMessage('Should have a valid job state'),

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
