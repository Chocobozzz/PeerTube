import express from 'express'
import { param, validationResult } from 'express-validator'
import { isIdOrUUIDValid, toCompleteUUID } from '@server/helpers/custom-validators/misc'
import { logger } from '../../../helpers/logger'

function areValidationErrors (req: express.Request, res: express.Response) {
  const errors = validationResult(req)

  if (!errors.isEmpty()) {
    logger.warn('Incorrect request parameters', { path: req.originalUrl, err: errors.mapped() })
    res.fail({
      message: 'Incorrect request parameters: ' + Object.keys(errors.mapped()).join(', '),
      instance: req.originalUrl,
      data: {
        'invalid-params': errors.mapped()
      }
    })

    return true
  }

  return false
}

function isValidVideoIdParam (paramName: string) {
  return param(paramName)
    .customSanitizer(toCompleteUUID)
    .custom(isIdOrUUIDValid).withMessage('Should have a valid video id')
}

function isValidPlaylistIdParam (paramName: string) {
  return param(paramName)
    .customSanitizer(toCompleteUUID)
    .custom(isIdOrUUIDValid).withMessage('Should have a valid playlist id')
}

// ---------------------------------------------------------------------------

export {
  areValidationErrors,
  isValidVideoIdParam,
  isValidPlaylistIdParam
}
