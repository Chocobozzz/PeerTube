import { body } from 'express-validator/check'
import * as express from 'express'

import { logger, isHostValid } from '../../../helpers'
import { checkErrors } from '../utils'

const signatureValidator = [
  body('signature.host').custom(isHostValid).withMessage('Should have a signature host'),
  body('signature.signature').not().isEmpty().withMessage('Should have a signature'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking signature parameters', { parameters: { signature: req.body.signature } })

    checkErrors(req, res, next)
  }
]

// ---------------------------------------------------------------------------

export {
  signatureValidator
}
