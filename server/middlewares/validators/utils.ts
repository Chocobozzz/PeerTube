import 'express-validator'
import * as express from 'express'
import { inspect } from 'util'

import { logger } from '../../helpers'

function checkErrors (req: express.Request, res: express.Response, next: express.NextFunction, statusCode = 400) {
  const errors = req.validationErrors()

  if (errors) {
    logger.warn('Incorrect request parameters', { path: req.originalUrl, err: errors })
    return res.status(statusCode).send('There have been validation errors: ' + inspect(errors))
  }

  return next()
}

// ---------------------------------------------------------------------------

export {
  checkErrors
}
