import * as express from 'express'
import { areValidationErrors } from './utils'
import { logger } from '../../helpers/logger'
import { query } from 'express-validator/check'
import { isNumberArray, isStringArray, isNSFWQueryValid } from '../../helpers/custom-validators/search'
import { isBooleanValid, isDateValid, toArray } from '../../helpers/custom-validators/misc'

const videosSearchValidator = [
  query('search').optional().not().isEmpty().withMessage('Should have a valid search'),

  query('startDate').optional().custom(isDateValid).withMessage('Should have a valid start date'),
  query('endDate').optional().custom(isDateValid).withMessage('Should have a valid end date'),

  query('durationMin').optional().isInt().withMessage('Should have a valid min duration'),
  query('durationMax').optional().isInt().withMessage('Should have a valid max duration'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videos search query', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const videoChannelsSearchValidator = [
  query('search').not().isEmpty().withMessage('Should have a valid search'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking video channels search query', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const commonVideosFiltersValidator = [
  query('categoryOneOf')
    .optional()
    .customSanitizer(toArray)
    .custom(isNumberArray).withMessage('Should have a valid one of category array'),
  query('licenceOneOf')
    .optional()
    .customSanitizer(toArray)
    .custom(isNumberArray).withMessage('Should have a valid one of licence array'),
  query('languageOneOf')
    .optional()
    .customSanitizer(toArray)
    .custom(isStringArray).withMessage('Should have a valid one of language array'),
  query('tagsOneOf')
    .optional()
    .customSanitizer(toArray)
    .custom(isStringArray).withMessage('Should have a valid one of tags array'),
  query('tagsAllOf')
    .optional()
    .customSanitizer(toArray)
    .custom(isStringArray).withMessage('Should have a valid all of tags array'),
  query('nsfw')
    .optional()
    .custom(isNSFWQueryValid).withMessage('Should have a valid NSFW attribute'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking commons video filters query', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  commonVideosFiltersValidator,
  videoChannelsSearchValidator,
  videosSearchValidator
}
