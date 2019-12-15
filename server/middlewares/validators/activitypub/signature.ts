import * as express from 'express'
import { body } from 'express-validator'
import {
  isSignatureCreatorValid, isSignatureTypeValid,
  isSignatureValueValid
} from '../../../helpers/custom-validators/activitypub/signature'
import { isDateValid } from '../../../helpers/custom-validators/misc'
import { logger } from '../../../helpers/logger'
import { areValidationErrors } from '../utils'

const signatureValidator = [
  body('signature.type')
    .optional()
    .custom(isSignatureTypeValid).withMessage('Should have a valid signature type'),
  body('signature.created')
    .optional()
    .custom(isDateValid).withMessage('Should have a valid signature created date'),
  body('signature.creator')
    .optional()
    .custom(isSignatureCreatorValid).withMessage('Should have a valid signature creator'),
  body('signature.signatureValue')
    .optional()
    .custom(isSignatureValueValid).withMessage('Should have a valid signature value'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking activitypub signature parameter', { parameters: { signature: req.body.signature } })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  signatureValidator
}
