import { doesJobExist } from '@server/helpers/middlewares'
import * as express from 'express'
import { param, query } from 'express-validator'
import { isIdValid } from '../../helpers/custom-validators/misc'
import { isValidJobState, isValidJobType } from '../../helpers/custom-validators/jobs'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'

const listJobsValidator = [
  param('state')
  .optional()
  .custom(isValidJobState).not().isEmpty().withMessage('Should have a valid job state'),

  query('jobType')
    .optional()
    .custom(isValidJobType).withMessage('Should have a valid job state'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listJobsValidator parameters.', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const videoTranscodingFileValidator = [
  param('jobId')
    .custom(isIdValid).not().isEmpty().withMessage('Should have a valid job id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoTranscodingFile parameters.', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesJobExist(req.params.jobId, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  listJobsValidator,
  videoTranscodingFileValidator
}
