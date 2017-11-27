import * as express from 'express'
import { body } from 'express-validator/check'
import { isDateValid, isSignatureCreatorValid, isSignatureTypeValid, isSignatureValueValid, logger } from '../../../helpers'
import { areValidationErrors } from '../utils'

const signatureValidator = [
  body('signature.type').custom(isSignatureTypeValid).withMessage('Should have a valid signature type'),
  body('signature.created').custom(isDateValid).withMessage('Should have a valid signature created date'),
  body('signature.creator').custom(isSignatureCreatorValid).withMessage('Should have a valid signature creator'),
  body('signature.signatureValue').custom(isSignatureValueValid).withMessage('Should have a valid signature value'),

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
