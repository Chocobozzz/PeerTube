import * as express from 'express'
import { query } from 'express-validator'
import { isSearchTargetValid } from '@server/helpers/custom-validators/search'
import { isDateValid } from '../../helpers/custom-validators/misc'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './shared'

const videosSearchValidator = [
  query('search').optional().not().isEmpty().withMessage('Should have a valid search'),

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

  query('durationMin').optional().isInt().withMessage('Should have a valid min duration'),
  query('durationMax').optional().isInt().withMessage('Should have a valid max duration'),

  query('searchTarget').optional().custom(isSearchTargetValid).withMessage('Should have a valid search target'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videos search query', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const videoChannelsListSearchValidator = [
  query('search').not().isEmpty().withMessage('Should have a valid search'),
  query('searchTarget').optional().custom(isSearchTargetValid).withMessage('Should have a valid search target'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking video channels search query', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const videoPlaylistsListSearchValidator = [
  query('search').not().isEmpty().withMessage('Should have a valid search'),
  query('searchTarget').optional().custom(isSearchTargetValid).withMessage('Should have a valid search target'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking video playlists search query', { parameters: req.query })

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
