import * as express from 'express'
import { param } from 'express-validator/check'
import { isAccountIdExist, isAccountNameValid, isLocalAccountNameExist } from '../../helpers/custom-validators/accounts'
import { isIdOrUUIDValid } from '../../helpers/custom-validators/misc'
import { logger } from '../../helpers/logger'
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

const accountsGetValidator = [
  param('id').custom(isIdOrUUIDValid).withMessage('Should have a valid id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking accountsGetValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isAccountIdExist(req.params.id, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  localAccountValidator,
  accountsGetValidator
}
