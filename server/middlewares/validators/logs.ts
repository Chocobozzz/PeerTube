import * as express from 'express'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { isDateValid } from '../../helpers/custom-validators/misc'
import { query } from 'express-validator'
import { isValidLogLevel } from '../../helpers/custom-validators/logs'

const getLogsValidator = [
  query('startDate')
    .custom(isDateValid).withMessage('Should have a valid start date'),
  query('level')
    .optional()
    .custom(isValidLogLevel).withMessage('Should have a valid level'),
  query('endDate')
    .optional()
    .custom(isDateValid).withMessage('Should have a valid end date'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking getLogsValidator parameters.', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const getAuditLogsValidator = [
  query('startDate')
    .custom(isDateValid).withMessage('Should have a valid start date'),
  query('endDate')
    .optional()
    .custom(isDateValid).withMessage('Should have a valid end date'),

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
