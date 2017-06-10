import 'express-validator'
import * as express from 'express'

import { checkErrors } from './utils'
import { logger } from '../../helpers'

function paginationValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkQuery('start', 'Should have a number start').optional().isInt()
  req.checkQuery('count', 'Should have a number count').optional().isInt()

  logger.debug('Checking pagination parameters', { parameters: req.query })

  checkErrors(req, res, next)
}

// ---------------------------------------------------------------------------

export {
  paginationValidator
}
