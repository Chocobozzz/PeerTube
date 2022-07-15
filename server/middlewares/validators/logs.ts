import express from 'express'
import { body, query } from 'express-validator'
import { isUrlValid } from '@server/helpers/custom-validators/activitypub/misc'
import { isStringArray } from '@server/helpers/custom-validators/search'
import { CONFIG } from '@server/initializers/config'
import { HttpStatusCode } from '@shared/models'
import {
  isValidClientLogLevel,
  isValidClientLogMessage,
  isValidClientLogMeta,
  isValidClientLogStackTrace,
  isValidClientLogUserAgent,
  isValidLogLevel
} from '../../helpers/custom-validators/logs'
import { isDateValid, toArray } from '../../helpers/custom-validators/misc'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './shared'

const createClientLogValidator = [
  body('message')
    .custom(isValidClientLogMessage).withMessage('Should have a valid log message'),

  body('url')
    .custom(isUrlValid).withMessage('Should have a valid log url'),

  body('level')
    .custom(isValidClientLogLevel).withMessage('Should have a valid log message'),

  body('stackTrace')
    .optional()
    .custom(isValidClientLogStackTrace).withMessage('Should have a valid log stack trace'),

  body('meta')
    .optional()
    .custom(isValidClientLogMeta).withMessage('Should have a valid log meta'),

  body('userAgent')
    .optional()
    .custom(isValidClientLogUserAgent).withMessage('Should have a valid log user agent'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking createClientLogValidator parameters.', { parameters: req.query })

    if (CONFIG.LOG.ACCEPT_CLIENT_LOG !== true) {
      return res.sendStatus(HttpStatusCode.FORBIDDEN_403)
    }

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const getLogsValidator = [
  query('startDate')
    .custom(isDateValid).withMessage('Should have a start date that conforms to ISO 8601'),
  query('level')
    .optional()
    .custom(isValidLogLevel).withMessage('Should have a valid level'),
  query('tagsOneOf')
    .optional()
    .customSanitizer(toArray)
    .custom(isStringArray).withMessage('Should have a valid one of tags array'),
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
  getAuditLogsValidator,
  createClientLogValidator
}
