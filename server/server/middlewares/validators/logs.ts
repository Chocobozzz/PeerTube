import express from 'express'
import { body, query } from 'express-validator'
import { isUrlValid } from '@server/helpers/custom-validators/activitypub/misc.js'
import { isStringArray } from '@server/helpers/custom-validators/search.js'
import { CONFIG } from '@server/initializers/config.js'
import { arrayify } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import {
  isValidClientLogLevel,
  isValidClientLogMessage,
  isValidClientLogMeta,
  isValidClientLogStackTrace,
  isValidClientLogUserAgent,
  isValidLogLevel
} from '../../helpers/custom-validators/logs.js'
import { isDateValid } from '../../helpers/custom-validators/misc.js'
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
    .customSanitizer(arrayify)
    .custom(isStringArray).withMessage('Should have a valid one of tags array'),
  query('endDate')
    .optional()
    .custom(isDateValid).withMessage('Should have an end date that conforms to ISO 8601'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
