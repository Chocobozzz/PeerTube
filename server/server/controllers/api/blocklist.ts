import express from 'express'
import { handleToNameAndHost } from '@server/helpers/actors.js'
import { logger } from '@server/helpers/logger.js'
import { AccountBlocklistModel } from '@server/models/account/account-blocklist.js'
import { getServerActor } from '@server/models/application/application.js'
import { ServerBlocklistModel } from '@server/models/server/server-blocklist.js'
import { MActorAccountId, MUserAccountId } from '@server/types/models/index.js'
import { BlockStatus } from '@peertube/peertube-models'
import { apiRateLimiter, asyncMiddleware, blocklistStatusValidator, optionalAuthenticate } from '../../middlewares/index.js'

const blocklistRouter = express.Router()

blocklistRouter.use(apiRateLimiter)

blocklistRouter.get('/status',
  optionalAuthenticate,
  blocklistStatusValidator,
  asyncMiddleware(getBlocklistStatus)
)

// ---------------------------------------------------------------------------

export {
  blocklistRouter
}

// ---------------------------------------------------------------------------

async function getBlocklistStatus (req: express.Request, res: express.Response) {
  const hosts = req.query.hosts as string[]
  const accounts = req.query.accounts as string[]
  const user = res.locals.oauth?.token.User

  const serverActor = await getServerActor()

  const byAccountIds = [ serverActor.Account.id ]
  if (user) byAccountIds.push(user.Account.id)

  const status: BlockStatus = {
    accounts: {},
    hosts: {}
  }

  const baseOptions = {
    byAccountIds,
    user,
    serverActor,
    status
  }

  await Promise.all([
    populateServerBlocklistStatus({ ...baseOptions, hosts }),
    populateAccountBlocklistStatus({ ...baseOptions, accounts })
  ])

  return res.json(status)
}

async function populateServerBlocklistStatus (options: {
  byAccountIds: number[]
  user?: MUserAccountId
  serverActor: MActorAccountId
  hosts: string[]
  status: BlockStatus
}) {
  const { byAccountIds, user, serverActor, hosts, status } = options

  if (!hosts || hosts.length === 0) return

  const serverBlocklistStatus = await ServerBlocklistModel.getBlockStatus(byAccountIds, hosts)

  logger.debug('Got server blocklist status.', { serverBlocklistStatus, byAccountIds, hosts })

  for (const host of hosts) {
    const block = serverBlocklistStatus.find(b => b.host === host)

    status.hosts[host] = getStatus(block, serverActor, user)
  }
}

async function populateAccountBlocklistStatus (options: {
  byAccountIds: number[]
  user?: MUserAccountId
  serverActor: MActorAccountId
  accounts: string[]
  status: BlockStatus
}) {
  const { byAccountIds, user, serverActor, accounts, status } = options

  if (!accounts || accounts.length === 0) return

  const accountBlocklistStatus = await AccountBlocklistModel.getBlockStatus(byAccountIds, accounts)

  logger.debug('Got account blocklist status.', { accountBlocklistStatus, byAccountIds, accounts })

  for (const account of accounts) {
    const sanitizedHandle = handleToNameAndHost(account)

    const block = accountBlocklistStatus.find(b => b.name === sanitizedHandle.name && b.host === sanitizedHandle.host)

    status.accounts[sanitizedHandle.handle] = getStatus(block, serverActor, user)
  }
}

function getStatus (block: { accountId: number }, serverActor: MActorAccountId, user?: MUserAccountId) {
  return {
    blockedByServer: !!(block && block.accountId === serverActor.Account.id),
    blockedByUser: !!(block && user && block.accountId === user.Account.id)
  }
}
