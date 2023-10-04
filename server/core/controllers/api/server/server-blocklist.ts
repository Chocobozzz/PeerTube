import 'multer'
import express from 'express'
import { HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { getServerActor } from '@server/models/application/application.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { getFormattedObjects } from '../../../helpers/utils.js'
import {
  addAccountInBlocklist,
  addServerInBlocklist,
  removeAccountFromBlocklist,
  removeServerFromBlocklist
} from '../../../lib/blocklist.js'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  ensureUserHasRight,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort
} from '../../../middlewares/index.js'
import {
  accountsBlocklistSortValidator,
  blockAccountValidator,
  blockServerValidator,
  serversBlocklistSortValidator,
  unblockAccountByServerValidator,
  unblockServerByServerValidator
} from '../../../middlewares/validators/index.js'
import { AccountBlocklistModel } from '../../../models/account/account-blocklist.js'
import { ServerBlocklistModel } from '../../../models/server/server-blocklist.js'

const serverBlocklistRouter = express.Router()

serverBlocklistRouter.get('/blocklist/accounts',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_ACCOUNTS_BLOCKLIST),
  paginationValidator,
  accountsBlocklistSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listBlockedAccounts)
)

serverBlocklistRouter.post('/blocklist/accounts',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_ACCOUNTS_BLOCKLIST),
  asyncMiddleware(blockAccountValidator),
  asyncRetryTransactionMiddleware(blockAccount)
)

serverBlocklistRouter.delete('/blocklist/accounts/:accountName',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_ACCOUNTS_BLOCKLIST),
  asyncMiddleware(unblockAccountByServerValidator),
  asyncRetryTransactionMiddleware(unblockAccount)
)

serverBlocklistRouter.get('/blocklist/servers',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVERS_BLOCKLIST),
  paginationValidator,
  serversBlocklistSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listBlockedServers)
)

serverBlocklistRouter.post('/blocklist/servers',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVERS_BLOCKLIST),
  asyncMiddleware(blockServerValidator),
  asyncRetryTransactionMiddleware(blockServer)
)

serverBlocklistRouter.delete('/blocklist/servers/:host',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVERS_BLOCKLIST),
  asyncMiddleware(unblockServerByServerValidator),
  asyncRetryTransactionMiddleware(unblockServer)
)

export {
  serverBlocklistRouter
}

// ---------------------------------------------------------------------------

async function listBlockedAccounts (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()

  const resultList = await AccountBlocklistModel.listForApi({
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    search: req.query.search,
    accountId: serverActor.Account.id
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function blockAccount (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()
  const accountToBlock = res.locals.account

  await addAccountInBlocklist(serverActor.Account.id, accountToBlock.id)

  UserNotificationModel.removeNotificationsOf({
    id: accountToBlock.id,
    type: 'account',
    forUserId: null // For all users
  }).catch(err => logger.error('Cannot remove notifications after an account mute.', { err }))

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function unblockAccount (req: express.Request, res: express.Response) {
  const accountBlock = res.locals.accountBlock

  await removeAccountFromBlocklist(accountBlock)

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function listBlockedServers (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()

  const resultList = await ServerBlocklistModel.listForApi({
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    search: req.query.search,
    accountId: serverActor.Account.id
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function blockServer (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()
  const serverToBlock = res.locals.server

  await addServerInBlocklist(serverActor.Account.id, serverToBlock.id)

  UserNotificationModel.removeNotificationsOf({
    id: serverToBlock.id,
    type: 'server',
    forUserId: null // For all users
  }).catch(err => logger.error('Cannot remove notifications after a server mute.', { err }))

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function unblockServer (req: express.Request, res: express.Response) {
  const serverBlock = res.locals.serverBlock

  await removeServerFromBlocklist(serverBlock)

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}
