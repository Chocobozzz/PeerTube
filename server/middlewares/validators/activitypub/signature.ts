import * as express from 'express'
import { body } from 'express-validator'
import {
  checkSignatureCreator, checkSignatureType,
  checkSignatureValue
} from '../../../helpers/custom-validators/activitypub/signature'
import { checkDate } from '../../../helpers/custom-validators/misc'
import { logger } from '../../../helpers/logger'
import { areValidationErrors } from '../utils'

const signatureValidator = [
  body('signature.type')
    .optional()
    .custom(checkSignatureType),
  body('signature.created')
    .optional()
    .custom(checkDate),
  body('signature.creator')
    .optional()
    .custom(checkSignatureCreator),
  body('signature.signatureValue')
    .optional()
    .custom(checkSignatureValue),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking Linked Data Signature parameter', { parameters: { signature: req.body.signature } })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  signatureValidator
}
