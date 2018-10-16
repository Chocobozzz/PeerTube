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
  blockAccountByAccountValidator,
  blockServerByAccountValidator,
  serversBlocklistSortValidator,
  unblockServerByAccountValidator
} from '../../../middlewares/validators'
import { UserModel } from '../../../models/account/user'
import { AccountModel } from '../../../models/account/account'
import { AccountBlocklistModel } from '../../../models/account/account-blocklist'
import { addAccountInBlocklist, addServerInBlocklist, removeAccountFromBlocklist, removeServerFromBlocklist } from '../../../lib/blocklist'
import { ServerBlocklistModel } from '../../../models/server/server-blocklist'
import { ServerModel } from '../../../models/server/server'

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
  asyncMiddleware(blockAccountByAccountValidator),
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
  asyncMiddleware(blockServerByAccountValidator),
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
  const user: UserModel = res.locals.oauth.token.User

  const resultList = await AccountBlocklistModel.listForApi(user.Account.id, req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function blockAccount (req: express.Request, res: express.Response) {
  const user: UserModel = res.locals.oauth.token.User
  const accountToBlock: AccountModel = res.locals.account

  await addAccountInBlocklist(user.Account.id, accountToBlock.id)

  return res.status(204).end()
}

async function unblockAccount (req: express.Request, res: express.Response) {
  const accountBlock: AccountBlocklistModel = res.locals.accountBlock

  await removeAccountFromBlocklist(accountBlock)

  return res.status(204).end()
}

async function listBlockedServers (req: express.Request, res: express.Response) {
  const user: UserModel = res.locals.oauth.token.User

  const resultList = await ServerBlocklistModel.listForApi(user.Account.id, req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function blockServer (req: express.Request, res: express.Response) {
  const user: UserModel = res.locals.oauth.token.User
  const serverToBlock: ServerModel = res.locals.server

  await addServerInBlocklist(user.Account.id, serverToBlock.id)

  return res.status(204).end()
}

async function unblockServer (req: express.Request, res: express.Response) {
  const serverBlock: ServerBlocklistModel = res.locals.serverBlock

  await removeServerFromBlocklist(serverBlock)

  return res.status(204).end()
}
