import * as express from 'express'
import { body, query } from 'express-validator'
import { exists, isDateValid } from '../../helpers/custom-validators/misc'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './shared'

const userHistoryListValidator = [
  query('search')
    .optional()
    .custom(exists).withMessage('Should have a valid search'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking userHistoryListValidator parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const userHistoryRemoveValidator = [
  body('beforeDate')
    .optional()
    .custom(isDateValid).withMessage('Should have a before date that conforms to ISO 8601'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking userHistoryRemoveValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  userHistoryListValidator,
  userHistoryRemoveValidator
}
