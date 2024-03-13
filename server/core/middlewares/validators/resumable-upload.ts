import { logger } from '@server/helpers/logger.js'
import express from 'express'
import { body, header } from 'express-validator'
import { areValidationErrors } from './shared/utils.js'
import { cleanUpReqFiles } from '@server/helpers/express-utils.js'

export const resumableInitValidator = [
  body('filename')
    .exists(),

  header('x-upload-content-length')
    .isNumeric()
    .exists()
    .withMessage('Should specify the file length'),
  header('x-upload-content-type')
    .isString()
    .exists()
    .withMessage('Should specify the file mimetype'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking resumableInitValidator parameters and headers', {
      parameters: req.body,
      headers: req.headers
    })

    if (areValidationErrors(req, res, { omitLog: true })) return cleanUpReqFiles(req)

    res.locals.uploadVideoFileResumableMetadata = {
      mimetype: req.headers['x-upload-content-type'] as string,
      size: +req.headers['x-upload-content-length'],
      originalname: req.body.filename
    }

    return next()
  }
]
