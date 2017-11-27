import * as express from 'express'
import { param } from 'express-validator/check'
import { logger } from '../../helpers'
import { checkLocalAccountNameExists, isAccountNameValid } from '../../helpers/custom-validators/accounts'
import { checkErrors } from './utils'

const localAccountValidator = [
  param('name').custom(isAccountNameValid).withMessage('Should have a valid account name'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking localAccountValidator parameters', { parameters: req.params })

    checkErrors(req, res, () => {
      checkLocalAccountNameExists(req.params.name, res, next)
    })
  }
]

// ---------------------------------------------------------------------------

export {
  localAccountValidator
}
