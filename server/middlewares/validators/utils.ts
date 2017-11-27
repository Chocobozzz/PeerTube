import { validationResult } from 'express-validator/check'
import * as express from 'express'

import { logger } from '../../helpers'

function checkErrors (req: express.Request, res: express.Response, next: express.NextFunction) {
  const errors = validationResult(req)

  if (!errors.isEmpty()) {
    logger.warn('Incorrect request parameters', { path: req.originalUrl, err: errors.mapped() })
    return res.status(400).json({ errors: errors.mapped() })
  }

  return next()
}

function areValidationErrors (req: express.Request, res: express.Response) {
  const errors = validationResult(req)

  if (!errors.isEmpty()) {
    logger.warn('Incorrect request parameters', { path: req.originalUrl, err: errors.mapped() })
    res.status(400).json({ errors: errors.mapped() })

    return true
  }

  return false
}

// ---------------------------------------------------------------------------

export {
  checkErrors,
  areValidationErrors
}
