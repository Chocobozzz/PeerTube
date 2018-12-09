import * as express from 'express'
import { areValidationErrors } from './utils'
import { logger } from '../../helpers/logger'
import { query } from 'express-validator/check'
import { isDateValid } from '../../helpers/custom-validators/misc'

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

// ---------------------------------------------------------------------------

export {
  videoChannelsSearchValidator,
  videosSearchValidator
}
