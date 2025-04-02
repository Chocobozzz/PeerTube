import express from 'express'
import { query } from 'express-validator'
import { isSearchTargetValid } from '@server/helpers/custom-validators/search.js'
import { isHostValid } from '@server/helpers/custom-validators/servers.js'
import { areUUIDsValid, isDateValid, isNotEmptyStringArray, toCompleteUUIDs } from '../../helpers/custom-validators/misc.js'
import { areValidationErrors } from './shared/index.js'

const videosSearchValidator = [
  query('search')
    .optional()
    .not().isEmpty(),

  query('startDate')
    .optional()
    .custom(isDateValid).withMessage('Should have a start date that conforms to ISO 8601'),
  query('endDate')
    .optional()
    .custom(isDateValid).withMessage('Should have a end date that conforms to ISO 8601'),

  query('originallyPublishedStartDate')
    .optional()
    .custom(isDateValid).withMessage('Should have a published start date that conforms to ISO 8601'),
  query('originallyPublishedEndDate')
    .optional()
    .custom(isDateValid).withMessage('Should have a published end date that conforms to ISO 8601'),

  query('durationMin')
    .optional()
    .isInt(),
  query('durationMax')
    .optional()
    .isInt(),

  query('uuids')
    .optional()
    .toArray()
    .customSanitizer(toCompleteUUIDs)
    .custom(areUUIDsValid).withMessage('Should have valid array of uuid'),

  query('searchTarget')
    .optional()
    .custom(isSearchTargetValid),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

const videoChannelsListSearchValidator = [
  query('search')
    .optional()
    .not().isEmpty(),

  query('host')
    .optional()
    .custom(isHostValid),

  query('searchTarget')
    .optional()
    .custom(isSearchTargetValid),

  query('handles')
    .optional()
    .toArray()
    .custom(isNotEmptyStringArray).withMessage('Should have valid array of handles'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

const videoPlaylistsListSearchValidator = [
  query('search')
    .optional()
    .not().isEmpty(),

  query('host')
    .optional()
    .custom(isHostValid),

  query('searchTarget')
    .optional()
    .custom(isSearchTargetValid),

  query('uuids')
    .optional()
    .toArray()
    .customSanitizer(toCompleteUUIDs)
    .custom(areUUIDsValid).withMessage('Should have valid array of uuid'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videosSearchValidator,
  videoChannelsListSearchValidator,
  videoPlaylistsListSearchValidator
}
