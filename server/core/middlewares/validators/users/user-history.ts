import express from 'express'
import { body, param, query } from 'express-validator'
import { exists, isDateValid, isIdValid } from '../../../helpers/custom-validators/misc.js'
import { areValidationErrors } from '../shared/index.js'

const userHistoryListValidator = [
  query('search')
    .optional()
    .custom(exists),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

const userHistoryRemoveAllValidator = [
  body('beforeDate')
    .optional()
    .custom(isDateValid).withMessage('Should have a before date that conforms to ISO 8601'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

const userHistoryRemoveElementValidator = [
  param('videoId')
    .custom(isIdValid),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  userHistoryListValidator,
  userHistoryRemoveElementValidator,
  userHistoryRemoveAllValidator
}
