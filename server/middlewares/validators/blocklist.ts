import { body, param } from 'express-validator'
import * as express from 'express'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { AccountBlocklistModel } from '../../models/account/account-blocklist'
import { isHostValid } from '../../helpers/custom-validators/servers'
import { ServerBlocklistModel } from '../../models/server/server-blocklist'
import { ServerModel } from '../../models/server/server'
import { WEBSERVER } from '../../initializers/constants'
import { doesAccountNameWithHostExist } from '../../helpers/middlewares'
import { getServerActor } from '@server/models/application/application'

const blockAccountValidator = [
  body('accountName').exists().withMessage('Should have an account name with host'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking blockAccountByAccountValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await doesAccountNameWithHostExist(req.body.accountName, res)) return

    const user = res.locals.oauth.token.User
    const accountToBlock = res.locals.account

    if (user.Account.id === accountToBlock.id) {
      res.status(409)
         .json({ error: 'You cannot block yourself.' })

      return
    }

    return next()
  }
]

const unblockAccountByAccountValidator = [
  param('accountName').exists().withMessage('Should have an account name with host'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking unblockAccountByAccountValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesAccountNameWithHostExist(req.params.accountName, res)) return

    const user = res.locals.oauth.token.User
    const targetAccount = res.locals.account
    if (!await doesUnblockAccountExist(user.Account.id, targetAccount.id, res)) return

    return next()
  }
]

const unblockAccountByServerValidator = [
  param('accountName').exists().withMessage('Should have an account name with host'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking unblockAccountByServerValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesAccountNameWithHostExist(req.params.accountName, res)) return

    const serverActor = await getServerActor()
    const targetAccount = res.locals.account
    if (!await doesUnblockAccountExist(serverActor.Account.id, targetAccount.id, res)) return

    return next()
  }
]

const blockServerValidator = [
  body('host').custom(isHostValid).withMessage('Should have a valid host'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking serverGetValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    const host: string = req.body.host

    if (host === WEBSERVER.HOST) {
      return res.status(409)
        .json({ error: 'You cannot block your own server.' })
    }

    const server = await ServerModel.loadOrCreateByHost(host)

    res.locals.server = server

    return next()
  }
]

const unblockServerByAccountValidator = [
  param('host').custom(isHostValid).withMessage('Should have an account name with host'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking unblockServerByAccountValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    const user = res.locals.oauth.token.User
    if (!await doesUnblockServerExist(user.Account.id, req.params.host, res)) return

    return next()
  }
]

const unblockServerByServerValidator = [
  param('host').custom(isHostValid).withMessage('Should have an account name with host'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking unblockServerByServerValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    const serverActor = await getServerActor()
    if (!await doesUnblockServerExist(serverActor.Account.id, req.params.host, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  blockServerValidator,
  blockAccountValidator,
  unblockAccountByAccountValidator,
  unblockServerByAccountValidator,
  unblockAccountByServerValidator,
  unblockServerByServerValidator
}

// ---------------------------------------------------------------------------

async function doesUnblockAccountExist (accountId: number, targetAccountId: number, res: express.Response) {
  const accountBlock = await AccountBlocklistModel.loadByAccountAndTarget(accountId, targetAccountId)
  if (!accountBlock) {
    res.status(404)
       .json({ error: 'Account block entry not found.' })

    return false
  }

  res.locals.accountBlock = accountBlock

  return true
}

async function doesUnblockServerExist (accountId: number, host: string, res: express.Response) {
  const serverBlock = await ServerBlocklistModel.loadByAccountAndHost(accountId, host)
  if (!serverBlock) {
    res.status(404)
       .json({ error: 'Server block entry not found.' })

    return false
  }

  res.locals.serverBlock = serverBlock

  return true
}
