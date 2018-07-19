import * as express from 'express'
import { areValidationErrors } from './utils'
import { logger } from '../../helpers/logger'
import { query } from 'express-validator/check'

const searchValidator = [
  query('search').not().isEmpty().withMessage('Should have a valid search'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking search parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  searchValidator
}
