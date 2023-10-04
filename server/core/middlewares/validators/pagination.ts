import express from 'express'
import { query } from 'express-validator'
import { PAGINATION } from '@server/initializers/constants.js'
import { areValidationErrors } from './shared/index.js'

const paginationValidator = paginationValidatorBuilder()

function paginationValidatorBuilder (tags: string[] = []) {
  return [
    query('start')
      .optional()
      .isInt({ min: 0 }),
    query('count')
      .optional()
      .isInt({ min: 0, max: PAGINATION.GLOBAL.COUNT.MAX }).withMessage(`Should have a number count (max: ${PAGINATION.GLOBAL.COUNT.MAX})`),

    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (areValidationErrors(req, res, { tags })) return

      return next()
    }
  ]
}

// ---------------------------------------------------------------------------

export {
  paginationValidator,
  paginationValidatorBuilder
}
