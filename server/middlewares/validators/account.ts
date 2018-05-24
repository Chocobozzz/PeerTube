import * as express from 'express'
import { param } from 'express-validator/check'
import {
  isAccountIdExist,
  isAccountIdValid,
  isAccountNameValid,
  isAccountNameWithHostExist,
  isLocalAccountNameExist
} from '../../helpers/custom-validators/accounts'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { isIdOrUUIDValid } from '../../helpers/custom-validators/misc'

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
  param('id').custom(isAccountIdValid).withMessage('Should have a valid id/uuid/name/name with host'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking accountsGetValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    let accountFetched = false
    if (isIdOrUUIDValid(req.params.id)) accountFetched = await isAccountIdExist(req.params.id, res, false)
    if (!accountFetched) accountFetched = await isAccountNameWithHostExist(req.params.id, res, true)

    if (!accountFetched) return

    return next()
  }
]

const accountsNameWithHostGetValidator = [
  param('nameWithHost').exists().withMessage('Should have an account name with host'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking accountsNameWithHostGetValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isAccountNameWithHostExist(req.params.nameWithHost, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  localAccountValidator,
  accountsGetValidator,
  accountsNameWithHostGetValidator
}
