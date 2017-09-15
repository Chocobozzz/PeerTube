import { query } from 'express-validator/check'
import * as express from 'express'

import { checkErrors } from './utils'
import { logger } from '../../helpers'

const paginationValidator = [
  query('start').optional().isInt().withMessage('Should have a number start'),
  query('count').optional().isInt().withMessage('Should have a number count'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking pagination parameters', { parameters: req.query })

    checkErrors(req, res, next)
  }
]

// ---------------------------------------------------------------------------

export {
  paginationValidator
}
