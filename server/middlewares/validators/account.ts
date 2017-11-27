import * as express from 'express'
import { param } from 'express-validator/check'
import { logger, isLocalAccountNameExist } from '../../helpers'
import { isAccountNameValid } from '../../helpers/custom-validators/accounts'
import { areValidationErrors } from './utils'

const localAccountValidator = [
  param('name').custom(isAccountNameValid).withMessage('Should have a valid account name'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking localAccountValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isLocalAccountNameExist(req.params.name, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  localAccountValidator
}
