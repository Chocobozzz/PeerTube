import { body } from 'express-validator/check'
import * as express from 'express'

import {
  logger,
  isDateValid,
  isSignatureTypeValid,
  isSignatureCreatorValid,
  isSignatureValueValid
} from '../../../helpers'
import { checkErrors } from '../utils'

const signatureValidator = [
  body('signature.type').custom(isSignatureTypeValid).withMessage('Should have a valid signature type'),
  body('signature.created').custom(isDateValid).withMessage('Should have a valid signature created date'),
  body('signature.creator').custom(isSignatureCreatorValid).withMessage('Should have a valid signature creator'),
  body('signature.signatureValue').custom(isSignatureValueValid).withMessage('Should have a valid signature value'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking activitypub signature parameter', { parameters: { signature: req.body.signature } })

    checkErrors(req, res, next)
  }
]

// ---------------------------------------------------------------------------

export {
  signatureValidator
}
