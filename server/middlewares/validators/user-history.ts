import * as express from 'express'
import { body } from 'express-validator'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { isDateValid } from '../../helpers/custom-validators/misc'

const userHistoryRemoveValidator = [
  body('beforeDate')
    .optional()
    .custom(isDateValid).withMessage('Should have a valid before date'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking userHistoryRemoveValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  userHistoryRemoveValidator
}
