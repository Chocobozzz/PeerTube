import { inspect } from 'util'

import { logger } from '../../helpers'

function checkErrors (req, res, next, statusCode?) {
  if (statusCode === undefined) statusCode = 400
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
