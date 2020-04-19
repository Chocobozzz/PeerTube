import * as express from 'express'
import 'multer'
import { getFormattedObjects } from '../../../helpers/utils'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  unblockAccountByAccountValidator
} from '../../../middlewares'
import {
  accountsBlocklistSortValidator,
  blockAccountValidator,
  blockServerValidator,
  serversBlocklistSortValidator,
  unblockServerByAccountValidator
} from '../../../middlewares/validators'
import { AccountBlocklistModel } from '../../../models/account/account-blocklist'
import { addAccountInBlocklist, addServerInBlocklist, removeAccountFromBlocklist, removeServerFromBlocklist } from '../../../lib/blocklist'
import { ServerBlocklistModel } from '../../../models/server/server-blocklist'

const myBlocklistRouter = express.Router()

myBlocklistRouter.get('/me/blocklist/accounts',
  authenticate,
  paginationValidator,
  accountsBlocklistSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listBlockedAccounts)
)

myBlocklistRouter.post('/me/blocklist/accounts',
  authenticate,
  asyncMiddleware(blockAccountValidator),
  asyncRetryTransactionMiddleware(blockAccount)
)

myBlocklistRouter.delete('/me/blocklist/accounts/:accountName',
  authenticate,
  asyncMiddleware(unblockAccountByAccountValidator),
  asyncRetryTransactionMiddleware(unblockAccount)
)

myBlocklistRouter.get('/me/blocklist/servers',
  authenticate,
  paginationValidator,
  serversBlocklistSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listBlockedServers)
)

myBlocklistRouter.post('/me/blocklist/servers',
  authenticate,
  asyncMiddleware(blockServerValidator),
  asyncRetryTransactionMiddleware(blockServer)
)

myBlocklistRouter.delete('/me/blocklist/servers/:host',
  authenticate,
  asyncMiddleware(unblockServerByAccountValidator),
  asyncRetryTransactionMiddleware(unblockServer)
)

export {
  myBlocklistRouter
}

// ---------------------------------------------------------------------------

async function listBlockedAccounts (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User

  const resultList = await AccountBlocklistModel.listForApi({
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    search: req.query.search,
    accountId: user.Account.id
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function blockAccount (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User
  const accountToBlock = res.locals.account

  await addAccountInBlocklist(user.Account.id, accountToBlock.id)

  return res.status(204).end()
}

async function unblockAccount (req: express.Request, res: express.Response) {
  const accountBlock = res.locals.accountBlock

  await removeAccountFromBlocklist(accountBlock)

  return res.status(204).end()
}

async function listBlockedServers (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User

  const resultList = await ServerBlocklistModel.listForApi({
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    search: req.query.search,
    accountId: user.Account.id
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function blockServer (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User
  const serverToBlock = res.locals.server

  await addServerInBlocklist(user.Account.id, serverToBlock.id)

  return res.status(204).end()
}

async function unblockServer (req: express.Request, res: express.Response) {
  const serverBlock = res.locals.serverBlock

  await removeServerFromBlocklist(serverBlock)

  return res.status(204).end()
}
