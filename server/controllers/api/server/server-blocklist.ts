import * as express from 'express'
import 'multer'
import { getFormattedObjects } from '../../../helpers/utils'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  ensureUserHasRight,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort
} from '../../../middlewares'
import {
  accountsBlocklistSortValidator,
  blockAccountValidator,
  blockServerValidator,
  serversBlocklistSortValidator,
  unblockAccountByServerValidator,
  unblockServerByServerValidator
} from '../../../middlewares/validators'
import { AccountBlocklistModel } from '../../../models/account/account-blocklist'
import { addAccountInBlocklist, addServerInBlocklist, removeAccountFromBlocklist, removeServerFromBlocklist } from '../../../lib/blocklist'
import { ServerBlocklistModel } from '../../../models/server/server-blocklist'
import { UserRight } from '../../../../shared/models/users'
import { getServerActor } from '@server/models/application/application'

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

  return res.status(204).end()
}

async function unblockAccount (req: express.Request, res: express.Response) {
  const accountBlock = res.locals.accountBlock

  await removeAccountFromBlocklist(accountBlock)

  return res.status(204).end()
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

  return res.status(204).end()
}

async function unblockServer (req: express.Request, res: express.Response) {
  const serverBlock = res.locals.serverBlock

  await removeServerFromBlocklist(serverBlock)

  return res.status(204).end()
}
