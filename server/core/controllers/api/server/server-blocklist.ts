import { AutoMuteList, BlocklistLogAction, HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { fetchAndValidateAutoMuteList } from '@server/lib/blocklist-subscriptions.js'
import { getServerActor } from '@server/models/application/application.js'
import express from 'express'
import 'multer'
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
  addBlocklistSubscriptionValidator,
  blockAccountValidator,
  blocklistSubscriptionsSortValidator,
  blockServerValidator,
  deleteBlocklistSubscriptionValidator,
  publicBlocklistLogValidator,
  serversBlocklistSortValidator,
  unblockAccountByServerValidator,
  unblockServerByServerValidator
} from '../../../middlewares/validators/index.js'
import { AccountBlocklistModel } from '../../../models/blocklist/account-blocklist.js'
import { BlocklistLogModel } from '../../../models/blocklist/blocklist-log.js'
import { BlocklistSubscriptionModel } from '../../../models/blocklist/blocklist-subscription.js'
import { ServerBlocklistModel } from '../../../models/blocklist/server-blocklist.js'

const serverBlocklistRouter = express.Router()

serverBlocklistRouter.get(
  '/blocklist/accounts',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVER_ACCOUNTS_BLOCKLIST),
  paginationValidator,
  accountsBlocklistSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listBlockedAccounts)
)

serverBlocklistRouter.post(
  '/blocklist/accounts',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVER_ACCOUNTS_BLOCKLIST),
  asyncMiddleware(blockAccountValidator),
  asyncRetryTransactionMiddleware(blockAccount)
)

serverBlocklistRouter.delete(
  '/blocklist/accounts/:accountName',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVER_ACCOUNTS_BLOCKLIST),
  asyncMiddleware(unblockAccountByServerValidator),
  asyncRetryTransactionMiddleware(unblockAccount)
)

serverBlocklistRouter.get(
  '/blocklist/servers',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVER_SERVERS_BLOCKLIST),
  paginationValidator,
  serversBlocklistSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listBlockedServers)
)

serverBlocklistRouter.post(
  '/blocklist/servers',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVER_SERVERS_BLOCKLIST),
  asyncMiddleware(blockServerValidator),
  asyncRetryTransactionMiddleware(blockServer)
)

serverBlocklistRouter.delete(
  '/blocklist/servers/:host',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVER_SERVERS_BLOCKLIST),
  asyncMiddleware(unblockServerByServerValidator),
  asyncRetryTransactionMiddleware(unblockServer)
)

// ---------------------------------------------------------------------------
// Blocklist subscriptions
// ---------------------------------------------------------------------------

serverBlocklistRouter.get(
  '/blocklist/subscriptions',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVER_BLOCKLIST_SUBSCRIPTIONS),
  paginationValidator,
  blocklistSubscriptionsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listBlocklistSubscriptions)
)

serverBlocklistRouter.post(
  '/blocklist/subscriptions',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVER_BLOCKLIST_SUBSCRIPTIONS),
  asyncMiddleware(addBlocklistSubscriptionValidator),
  asyncRetryTransactionMiddleware(addBlocklistSubscription)
)

serverBlocklistRouter.delete(
  '/blocklist/subscriptions/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVER_BLOCKLIST_SUBSCRIPTIONS),
  asyncMiddleware(deleteBlocklistSubscriptionValidator),
  asyncRetryTransactionMiddleware(deleteBlocklistSubscription)
)

// ---------------------------------------------------------------------------
// Public blocklist log
// ---------------------------------------------------------------------------

serverBlocklistRouter.get(
  '/blocklist/public-log',
  publicBlocklistLogValidator,
  asyncMiddleware(listPublicBlocklistLog)
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
    subscriptionName: req.query.subscriptionName,
    accountId: serverActor.Account.id
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function blockAccount (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()
  const accountToBlock = res.locals.account

  await addAccountInBlocklist({
    byAccountId: serverActor.Account.id,
    targetAccount: accountToBlock,
    removeNotificationOfUserId: null
  })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function unblockAccount (req: express.Request, res: express.Response) {
  const accountBlock = res.locals.accountBlock

  await removeAccountFromBlocklist(accountBlock)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function listBlockedServers (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()

  const resultList = await ServerBlocklistModel.listForApi({
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    search: req.query.search,
    subscriptionName: req.query.subscriptionName,
    accountId: serverActor.Account.id
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function blockServer (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()
  const serverToBlock = res.locals.server

  await addServerInBlocklist({
    byAccountId: serverActor.Account.id,
    targetServer: serverToBlock,
    removeNotificationOfUserId: null
  })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function unblockServer (req: express.Request, res: express.Response) {
  const serverBlock = res.locals.serverBlock

  await removeServerFromBlocklist(serverBlock)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function listBlocklistSubscriptions (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()

  const resultList = await BlocklistSubscriptionModel.listForApi({
    accountId: serverActor.Account.id,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    search: req.query.search
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function addBlocklistSubscription (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()

  try {
    const { name: listName } = await fetchAndValidateAutoMuteList(req.body.url)

    const subscription = await BlocklistSubscriptionModel.create({
      accountId: serverActor.Account.id,
      name: listName,
      url: req.body.url,
      lastSyncAt: null
    })

    return res.json(subscription.toFormattedJSON())
  } catch (err) {
    logger.warn('Failed to fetch or parse auto mute list URL when adding blocklist subscription.', { url: req.body.url, err })

    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: req.t('Cannot fetch or parse auto mute list URL')
    })
  }
}

async function deleteBlocklistSubscription (req: express.Request, res: express.Response) {
  const subscription = res.locals.blocklistSubscription

  await subscription.destroy()

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function listPublicBlocklistLog (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()

  const resultList = await BlocklistLogModel.listPublicForApi({
    accountId: serverActor.Account.id,
    startDate: req.query.startDate,
    start: 0,
    count: 500,
    sort: 'createdAt'
  })

  const payload: AutoMuteList = {
    name: CONFIG.INSTANCE.NAME,
    actions: resultList.data.map(log => {
      return {
        type: mapBlocklistLogAction(log.action),
        target: log.target,
        createdAt: new Date(log.createdAt).toISOString()
      }
    })
  }

  return res.json(payload)
}

function mapBlocklistLogAction (action: BlocklistLogAction): 'block' | 'unblock' {
  if (action === 'add') return 'block'

  return 'unblock'
}
