import * as express from 'express'
import { param, query, validationResult } from 'express-validator'
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

function checkSort (sortableColumns: string[], tags: string[] = []) {
  return [
    query('sort').optional().isIn(sortableColumns).withMessage('Should have correct sortable column'),

    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.debug('Checking sort parameters', { parameters: req.query, tags })

      if (areValidationErrors(req, res)) return

      return next()
    }
  ]
}

function createSortableColumns (sortableColumns: string[]) {
  const sortableColumnDesc = sortableColumns.map(sortableColumn => '-' + sortableColumn)

  return sortableColumns.concat(sortableColumnDesc)
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
  checkSort,
  createSortableColumns,
  isValidVideoIdParam,
  isValidPlaylistIdParam
}
