import { param, body } from 'express-validator/check'
import * as express from 'express'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { isAccountNameWithHostExist } from '../../helpers/custom-validators/accounts'
import { UserModel } from '../../models/account/user'
import { AccountBlocklistModel } from '../../models/account/account-blocklist'
import { isHostValid } from '../../helpers/custom-validators/servers'
import { ServerBlocklistModel } from '../../models/server/server-blocklist'

const blockAccountByAccountValidator = [
  body('accountName').exists().withMessage('Should have an account name with host'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking blockAccountByAccountValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await isAccountNameWithHostExist(req.body.accountName, res)) return

    return next()
  }
]

const unblockAccountByAccountValidator = [
  param('accountName').exists().withMessage('Should have an account name with host'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking unblockAccountByAccountValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isAccountNameWithHostExist(req.params.accountName, res)) return

    const user = res.locals.oauth.token.User as UserModel
    const targetAccount = res.locals.account
    if (!await isUnblockAccountExists(user.Account.id, targetAccount.id, res)) return

    return next()
  }
]

const unblockServerByAccountValidator = [
  param('host').custom(isHostValid).withMessage('Should have an account name with host'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking unblockServerByAccountValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    const user = res.locals.oauth.token.User as UserModel
    if (!await isUnblockServerExists(user.Account.id, req.params.host, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  blockAccountByAccountValidator,
  unblockAccountByAccountValidator,
  unblockServerByAccountValidator
}

// ---------------------------------------------------------------------------

async function isUnblockAccountExists (accountId: number, targetAccountId: number, res: express.Response) {
  const accountBlock = await AccountBlocklistModel.loadByAccountAndTarget(accountId, targetAccountId)
  if (!accountBlock) {
    res.status(404)
       .send({ error: 'Account block entry not found.' })
       .end()

    return false
  }

  res.locals.accountBlock = accountBlock

  return true
}

async function isUnblockServerExists (accountId: number, host: string, res: express.Response) {
  const serverBlock = await ServerBlocklistModel.loadByAccountAndHost(accountId, host)
  if (!serverBlock) {
    res.status(404)
       .send({ error: 'Server block entry not found.' })
       .end()

    return false
  }

  res.locals.serverBlock = serverBlock

  return true
}
