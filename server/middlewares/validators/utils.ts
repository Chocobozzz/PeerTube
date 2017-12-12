import * as express from 'express'
import { validationResult } from 'express-validator/check'
import { logger } from '../../helpers'

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
  areValidationErrors
}
