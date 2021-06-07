import * as express from 'express'
import { body } from 'express-validator'
import {
  isSignatureCreatorValid,
  isSignatureTypeValid,
  isSignatureValueValid
} from '../../../helpers/custom-validators/activitypub/signature'
import { isDateValid } from '../../../helpers/custom-validators/misc'
import { logger } from '../../../helpers/logger'
import { areValidationErrors } from '../shared'

const signatureValidator = [
  body('signature.type')
    .optional()
    .custom(isSignatureTypeValid).withMessage('Should have a valid signature type'),
  body('signature.created')
    .optional()
    .custom(isDateValid).withMessage('Should have a signature created date that conforms to ISO 8601'),
  body('signature.creator')
    .optional()
    .custom(isSignatureCreatorValid).withMessage('Should have a valid signature creator'),
  body('signature.signatureValue')
    .optional()
    .custom(isSignatureValueValid).withMessage('Should have a valid signature value'),

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
