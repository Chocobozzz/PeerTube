import * as express from 'express'
import { param } from 'express-validator'
import { isValidJobState } from '../../helpers/custom-validators/jobs'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'

const listJobsValidator = [
  param('state').custom(isValidJobState).not().isEmpty().withMessage('Should have a valid job state'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listJobsValidator parameters.', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  listJobsValidator
}
