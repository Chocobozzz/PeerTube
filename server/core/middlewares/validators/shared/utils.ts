import express from 'express'
import { param, validationResult } from 'express-validator'
import { isIdOrUUIDValid, toCompleteUUID } from '@server/helpers/custom-validators/misc.js'
import { logger } from '../../../helpers/logger.js'

function areValidationErrors (
  req: express.Request,
  res: express.Response,
  options: {
    omitLog?: boolean
    omitBodyLog?: boolean
    tags?: (number | string)[]
  } = {}) {
  const { omitLog = false, omitBodyLog = false, tags = [] } = options

  if (!omitLog) {
    logger.debug(
      'Checking %s - %s parameters',
      req.method, req.originalUrl,
      {
        body: omitBodyLog
          ? 'omitted'
          : req.body,
        params: req.params,
        query: req.query,
        files: req.files,
        tags
      }
    )
  }

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
    .custom(isIdOrUUIDValid).withMessage('Should have a valid video id (id, short UUID or UUID)')
}

function isValidPlaylistIdParam (paramName: string) {
  return param(paramName)
    .customSanitizer(toCompleteUUID)
    .custom(isIdOrUUIDValid).withMessage('Should have a valid playlist id (id, short UUID or UUID)')
}

// ---------------------------------------------------------------------------

export {
  areValidationErrors,
  isValidVideoIdParam,
  isValidPlaylistIdParam
}
