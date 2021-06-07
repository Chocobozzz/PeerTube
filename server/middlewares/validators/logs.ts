import * as express from 'express'
import { query } from 'express-validator'
import { isValidLogLevel } from '../../helpers/custom-validators/logs'
import { isDateValid } from '../../helpers/custom-validators/misc'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './shared'

const getLogsValidator = [
  query('startDate')
    .custom(isDateValid).withMessage('Should have a start date that conforms to ISO 8601'),
  query('level')
    .optional()
    .custom(isValidLogLevel).withMessage('Should have a valid level'),
  query('endDate')
    .optional()
    .custom(isDateValid).withMessage('Should have an end date that conforms to ISO 8601'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking getLogsValidator parameters.', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const getAuditLogsValidator = [
  query('startDate')
    .custom(isDateValid).withMessage('Should have a start date that conforms to ISO 8601'),
  query('endDate')
    .optional()
    .custom(isDateValid).withMessage('Should have a end date that conforms to ISO 8601'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking getAuditLogsValidator parameters.', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  getLogsValidator,
  getAuditLogsValidator
}
