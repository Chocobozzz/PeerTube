import * as express from 'express'
import { query } from 'express-validator'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'

const paginationValidator = [
  query('start').optional().isInt({ min: 0 }).withMessage('Should have a number start'),
  query('count').optional().isInt({ min: 0 }).withMessage('Should have a number count'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking pagination parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  paginationValidator
}
