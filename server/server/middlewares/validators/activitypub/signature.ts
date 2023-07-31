import express from 'express'
import { body } from 'express-validator'
import {
  isSignatureCreatorValid,
  isSignatureTypeValid,
  isSignatureValueValid
} from '../../../helpers/custom-validators/activitypub/signature.js'
import { isDateValid } from '../../../helpers/custom-validators/misc.js'
import { logger } from '../../../helpers/logger.js'
import { areValidationErrors } from '../shared/index.js'

const signatureValidator = [
  body('signature.type')
    .optional()
    .custom(isSignatureTypeValid),
  body('signature.created')
    .optional()
    .custom(isDateValid).withMessage('Should have a signature created date that conforms to ISO 8601'),
  body('signature.creator')
    .optional()
    .custom(isSignatureCreatorValid),
  body('signature.signatureValue')
    .optional()
    .custom(isSignatureValueValid),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking Linked Data Signature parameter', { parameters: { signature: req.body.signature } })

    if (areValidationErrors(req, res, { omitLog: true })) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  signatureValidator
}
