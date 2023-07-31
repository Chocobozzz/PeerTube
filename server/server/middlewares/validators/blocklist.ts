import express from 'express'
import { body, param, query } from 'express-validator'
import { areValidActorHandles } from '@server/helpers/custom-validators/activitypub/actor.js'
import { getServerActor } from '@server/models/application/application.js'
import { arrayify } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import { isEachUniqueHostValid, isHostValid } from '../../helpers/custom-validators/servers.js'
import { WEBSERVER } from '../../initializers/constants.js'
import { AccountBlocklistModel } from '../../models/account/account-blocklist.js'
import { ServerBlocklistModel } from '../../models/server/server-blocklist.js'
import { ServerModel } from '../../models/server/server.js'
import { areValidationErrors, doesAccountNameWithHostExist } from './shared/index.js'

const blockAccountValidator = [
  body('accountName')
    .exists(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesAccountNameWithHostExist(req.body.accountName, res)) return

    const user = res.locals.oauth.token.User
    const accountToBlock = res.locals.account

    if (user.Account.id === accountToBlock.id) {
      res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: 'You cannot block yourself.'
      })
      return
    }

    return next()
  }
]

const unblockAccountByAccountValidator = [
  param('accountName')
    .exists(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesAccountNameWithHostExist(req.params.accountName, res)) return

    const user = res.locals.oauth.token.User
    const targetAccount = res.locals.account
    if (!await doesUnblockAccountExist(user.Account.id, targetAccount.id, res)) return

    return next()
  }
]

const unblockAccountByServerValidator = [
  param('accountName')
    .exists(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesAccountNameWithHostExist(req.params.accountName, res)) return

    const serverActor = await getServerActor()
    const targetAccount = res.locals.account
    if (!await doesUnblockAccountExist(serverActor.Account.id, targetAccount.id, res)) return

    return next()
  }
]

const blockServerValidator = [
  body('host')
    .custom(isHostValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const host: string = req.body.host

    if (host === WEBSERVER.HOST) {
      return res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: 'You cannot block your own server.'
      })
    }

    const server = await ServerModel.loadOrCreateByHost(host)

    res.locals.server = server

    return next()
  }
]

const unblockServerByAccountValidator = [
  param('host')
    .custom(isHostValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const user = res.locals.oauth.token.User
    if (!await doesUnblockServerExist(user.Account.id, req.params.host, res)) return

    return next()
  }
]

const unblockServerByServerValidator = [
  param('host')
    .custom(isHostValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const serverActor = await getServerActor()
    if (!await doesUnblockServerExist(serverActor.Account.id, req.params.host, res)) return

    return next()
  }
]

const blocklistStatusValidator = [
  query('hosts')
    .optional()
    .customSanitizer(arrayify)
    .custom(isEachUniqueHostValid).withMessage('Should have a valid hosts array'),

  query('accounts')
    .optional()
    .customSanitizer(arrayify)
    .custom(areValidActorHandles).withMessage('Should have a valid accounts array'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

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
  unblockServerByServerValidator,
  blocklistStatusValidator
}

// ---------------------------------------------------------------------------

async function doesUnblockAccountExist (accountId: number, targetAccountId: number, res: express.Response) {
  const accountBlock = await AccountBlocklistModel.loadByAccountAndTarget(accountId, targetAccountId)
  if (!accountBlock) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Account block entry not found.'
    })
    return false
  }

  res.locals.accountBlock = accountBlock
  return true
}

async function doesUnblockServerExist (accountId: number, host: string, res: express.Response) {
  const serverBlock = await ServerBlocklistModel.loadByAccountAndHost(accountId, host)
  if (!serverBlock) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Server block entry not found.'
    })
    return false
  }

  res.locals.serverBlock = serverBlock
  return true
}
