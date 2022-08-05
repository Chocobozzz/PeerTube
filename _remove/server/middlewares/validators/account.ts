import express from 'express'
import { param } from 'express-validator'
import { isAccountNameValid } from '../../helpers/custom-validators/accounts'
import { logger } from '../../helpers/logger'
import { areValidationErrors, doesAccountNameWithHostExist, doesLocalAccountNameExist } from './shared'

const localAccountValidator = [
  param('name').custom(isAccountNameValid).withMessage('Should have a valid account name'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking localAccountValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesLocalAccountNameExist(req.params.name, res)) return

    return next()
  }
]

const accountNameWithHostGetValidator = [
  param('accountName').exists().withMessage('Should have an account name with host'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking accountsNameWithHostGetValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesAccountNameWithHostExist(req.params.accountName, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  localAccountValidator,
  accountNameWithHostGetValidator
}
