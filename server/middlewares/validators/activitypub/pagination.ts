import * as express from 'express'
import { query } from 'express-validator'
import { logger } from '../../../helpers/logger'
import { areValidationErrors } from '../utils'
import { PAGINATION } from '@server/initializers/constants'

const apPaginationValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Should have a valid page number'),
  query('size')
    .optional()
    .isInt({ min: 0, max: PAGINATION.OUTBOX.COUNT.MAX }).withMessage(`Should have a valid page size (max: ${PAGINATION.OUTBOX.COUNT.MAX})`),

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
