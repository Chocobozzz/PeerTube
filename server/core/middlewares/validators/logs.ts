import { HttpStatusCode } from '@peertube/peertube-models'
import { isStringArray } from '@server/helpers/custom-validators/search.js'
import { isUrlValid } from '@server/helpers/custom-validators/urls.js'
import { CONFIG } from '@server/initializers/config.js'
import express from 'express'
import { body, query } from 'express-validator'
import {
  isValidAuditLogAction,
  isValidAuditLogEntityType,
  isValidClientLogLevel,
  isValidClientLogMessage,
  isValidClientLogMeta,
  isValidClientLogStackTrace,
  isValidClientLogUserAgent,
  isValidLogLevel
} from '../../helpers/custom-validators/logs.js'
import { exists, isDateValid, isIdValid, toArray } from '../../helpers/custom-validators/misc.js'
import { areValidationErrors } from './shared/index.js'

const createClientLogValidator = [
  body('message')
    .custom(isValidClientLogMessage),

  body('url')
    .custom(isUrlValid),

  body('level')
    .custom(isValidClientLogLevel),

  body('stackTrace')
    .optional()
    .custom(isValidClientLogStackTrace),

  body('meta')
    .optional()
    .custom(isValidClientLogMeta),

  body('userAgent')
    .optional()
    .custom(isValidClientLogUserAgent),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
    .custom(isValidLogLevel),
  query('tagsOneOf')
    .optional()
    .customSanitizer(toArray)
    .custom(isStringArray).withMessage('Should have a valid tags one of array'),
  query('endDate')
    .optional()
    .custom(isDateValid).withMessage('Should have an end date that conforms to ISO 8601'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

const getAuditLogsValidator = [
  query('format')
    .optional()
    .isIn([ 'array', 'list' ]).withMessage('Should have a valid format (array, list)'),
  query('search')
    .optional()
    .custom(exists),
  query('entityType')
    .optional()
    .custom(isValidAuditLogEntityType),
  query('entityId')
    .optional()
    .custom(isIdValid),
  query('action')
    .optional()
    .custom(isValidAuditLogAction),
  // Required by the default array format
  query('startDate')
    .if((_value, { req }) => req.query.format !== 'list')
    .custom(isDateValid).withMessage('Should have a start date that conforms to ISO 8601'),
  query('startDate')
    .optional()
    .custom(isDateValid).withMessage('Should have a start date that conforms to ISO 8601'),
  query('endDate')
    .optional()
    .custom(isDateValid).withMessage('Should have a end date that conforms to ISO 8601'),

  ensureAuditLogIsEnabled
]

// ---------------------------------------------------------------------------

export {
  createClientLogValidator,
  getAuditLogsValidator,
  getLogsValidator
}

// ---------------------------------------------------------------------------

function ensureAuditLogIsEnabled (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (CONFIG.LOG.AUDIT.ENABLED !== true) {
    return res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: req.t('Audit log is disabled on this instance')
    })
  }

  if (areValidationErrors(req, res)) return

  return next()
}
