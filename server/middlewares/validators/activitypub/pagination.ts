import * as express from 'express'
import { query } from 'express-validator'
import { logger } from '../../../helpers/logger'
import { areValidationErrors } from '../utils'

const apPaginationValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Should have a valid page number'),
  query('size').optional().isInt({ max: 50 }).withMessage('Should have a valid page size (max: 50)'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking pagination parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  apPaginationValidator
}
