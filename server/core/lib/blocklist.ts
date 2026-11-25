import { runTransaction } from '@server/helpers/database-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { MEMOIZE_TTL } from '@server/initializers/constants.js'
import { AccountModel } from '@server/models/account/account.js'
import { getServerAccount } from '@server/models/application/application.js'
import { ServerModel } from '@server/models/server/server.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import {
  MAccount,
  MAccountBlocklist,
  MAccountDefault,
  MAccountId,
  MActor,
  MBlocklistSubscription,
  MServer,
  MServerBlocklist
} from '@server/types/models/index.js'
import memoizee from 'memoizee'
import { AccountBlocklistModel } from '../models/blocklist/account-blocklist.js'
import { BlocklistLogModel } from '../models/blocklist/blocklist-log.js'
import { ServerBlocklistModel } from '../models/blocklist/server-blocklist.js'
import { RedisChannels } from './redis/redis-channels.js'

const logger = createLogger()

export async function addAccountInBlocklist (options: {
  byAccountId: number
  targetAccount: MAccountDefault
  blocklistSubscription?: MBlocklistSubscription

  removeNotificationOfUserId: number | null // If blocked by a user
}) {
  const { byAccountId, targetAccount, blocklistSubscription, removeNotificationOfUserId } = options

  await runTransaction(async t => {
    const existing = await AccountBlocklistModel.loadByAccountAndTarget(byAccountId, targetAccount.id, t)

    if (!existing) {
      await AccountBlocklistModel.create({
        accountId: byAccountId,
        targetAccountId: targetAccount.id,
        blocklistSubscriptionId: blocklistSubscription?.id
      }, { transaction: t })

      await BlocklistLogModel.create({
        action: 'add',
        accountId: byAccountId,
        blocklistSubscriptionId: blocklistSubscription?.id,
        automaticallyCreated: !!blocklistSubscription,
        target: targetAccount.Actor.getFullIdentifier()
      }, { transaction: t })
    }
  })

  await clearAccountsMutedByServerCacheIfNeeded(byAccountId)

  UserNotificationModel.removeNotificationsOf({
    id: targetAccount.id,
    type: 'account',
    forUserId: removeNotificationOfUserId
  }).catch(err => logger.error('Cannot remove notifications after an account mute.', { err }))
}

export async function addServerInBlocklist (options: {
  byAccountId: number
  targetServer: MServer
  blocklistSubscription?: MBlocklistSubscription
  removeNotificationOfUserId: number | null
}) {
  const { byAccountId, targetServer, blocklistSubscription, removeNotificationOfUserId } = options

  await runTransaction(async t => {
    const existing = await ServerBlocklistModel.loadByAccountAndTarget(byAccountId, targetServer.id, t)

    if (!existing) {
      await ServerBlocklistModel.create({
        accountId: byAccountId,
        targetServerId: targetServer.id,
        blocklistSubscriptionId: blocklistSubscription?.id
      }, { transaction: t })

      await BlocklistLogModel.create({
        action: 'add',
        accountId: byAccountId,
        blocklistSubscriptionId: blocklistSubscription?.id,
        automaticallyCreated: !!blocklistSubscription,
        target: targetServer.host
      }, { transaction: t })
    }
  })

  await clearHostsMutedByServerCacheIfNeeded(byAccountId)

  UserNotificationModel.removeNotificationsOf({
    id: targetServer.id,
    type: 'server',
    forUserId: removeNotificationOfUserId
  }).catch(err => logger.error('Cannot remove notifications after a server mute.', { err }))
}

export async function removeAccountFromBlocklist (accountBlock: MAccountBlocklist) {
  await runTransaction(async t => {
    const targetAccount = await AccountModel.load(accountBlock.targetAccountId, t)

    await BlocklistLogModel.create({
      action: 'delete',
      accountId: accountBlock.accountId,
      blocklistSubscriptionId: accountBlock.blocklistSubscriptionId,
      automaticallyCreated: !!accountBlock.blocklistSubscriptionId,
      target: targetAccount.Actor.getFullIdentifier()
    }, { transaction: t })

    await accountBlock.destroy({ transaction: t })
  })

  await clearAccountsMutedByServerCacheIfNeeded(accountBlock.accountId)
}

export async function removeServerFromBlocklist (serverBlock: MServerBlocklist) {
  await runTransaction(async t => {
    const targetServer = await ServerModel.load(serverBlock.targetServerId, t)

    await BlocklistLogModel.create({
      action: 'delete',
      accountId: serverBlock.accountId,
      blocklistSubscriptionId: serverBlock.blocklistSubscriptionId,
      automaticallyCreated: !!serverBlock.blocklistSubscriptionId,
      target: targetServer.host
    }, { transaction: t })

    await serverBlock.destroy({ transaction: t })
  })

  await clearHostsMutedByServerCacheIfNeeded(serverBlock.accountId)
}

export type BlocklistTargetAccount = Pick<MAccount, 'id'> & { Actor: Pick<MActor, 'serverId'> }

export async function isBlockedByServerOrAccount (targetAccount: BlocklistTargetAccount, userAccount?: MAccountId) {
  const serverAccountId = (await getServerAccount()).id
  const sourceAccounts = [ serverAccountId ]

  if (userAccount) sourceAccounts.push(userAccount.id)

  const accountMutedHash = await AccountBlocklistModel.isAccountMutedByAccounts(sourceAccounts, targetAccount.id)
  if (accountMutedHash[serverAccountId] || (userAccount && accountMutedHash[userAccount.id])) {
    return true
  }

  const instanceMutedHash = await ServerBlocklistModel.isServerMutedByAccounts(sourceAccounts, targetAccount.Actor.serverId)
  if (instanceMutedHash[serverAccountId] || (userAccount && instanceMutedHash[userAccount.id])) {
    return true
  }

  return false
}

export async function isHostBlockedByServerOrAccount (host: string, userAccount?: MAccountId) {
  if (!host) return false
  if (await isHostMutedByServer(host)) return true
  if (!userAccount) return false

  const rows = await ServerBlocklistModel.getBlockStatus([ userAccount.id ], [ host.toLowerCase() ])

  return rows.length !== 0
}

// ---------------------------------------------------------------------------
// Servers and accounts muted by the instance, checked on every inbox activity and video get so kept in memory
// Cleared on changes, on every process of the platform
// ---------------------------------------------------------------------------

const listServersMutedByServer = memoizee(async () => {
  const serverAccount = await getServerAccount()
  const servers = await ServerBlocklistModel.listServersBlockedBy([ serverAccount.id ])

  return {
    hosts: new Set(servers.map(s => s.host.toLowerCase())),
    ids: new Set(servers.map(s => s.id))
  }
}, { promise: true, maxAge: MEMOIZE_TTL.MUTED_BY_SERVER })

const listAccountIdsMutedByServer = memoizee(async () => {
  const serverAccount = await getServerAccount()

  return new Set(await AccountBlocklistModel.listAccountIdsBlockedBy([ serverAccount.id ]))
}, { promise: true, maxAge: MEMOIZE_TTL.MUTED_BY_SERVER })

export function clearHostsMutedByServerCache () {
  listServersMutedByServer.clear()
  RedisChannels.mutedByServerInvalidation.broadcast({ type: 'servers' })
}

export function clearAccountsMutedByServerCache () {
  listAccountIdsMutedByServer.clear()
  RedisChannels.mutedByServerInvalidation.broadcast({ type: 'accounts' })
}

export async function listenForMutedByServerInvalidations () {
  await RedisChannels.mutedByServerInvalidation.subscribe(payload => {
    if (payload?.type === 'servers') listServersMutedByServer.clear()
    else if (payload?.type === 'accounts') listAccountIdsMutedByServer.clear()
  })
}

async function clearHostsMutedByServerCacheIfNeeded (byAccountId: number) {
  // Mutes of users are not cached
  if (byAccountId !== (await getServerAccount()).id) return

  clearHostsMutedByServerCache()
}

async function clearAccountsMutedByServerCacheIfNeeded (byAccountId: number) {
  // Mutes of users are not cached
  if (byAccountId !== (await getServerAccount()).id) return

  clearAccountsMutedByServerCache()
}

export async function isHostMutedByServer (host: string) {
  if (!host) return false

  const { hosts } = await listServersMutedByServer()

  return hosts.has(host.toLowerCase())
}

export async function getCachedMuteOfServer (account: BlocklistTargetAccount): Promise<'account' | 'server' | undefined> {
  const [ servers, accountIds ] = await Promise.all([ listServersMutedByServer(), listAccountIdsMutedByServer() ])

  if (accountIds.has(account.id)) return 'account'
  if (account.Actor.serverId && servers.ids.has(account.Actor.serverId)) return 'server'

  return undefined
}

export function isUrlHostMutedByServer (url: string) {
  let host: string

  try {
    host = new URL(url).host
  } catch {
    return Promise.resolve(false)
  }

  return isHostMutedByServer(host)
}

// Activities of servers muted by the instance are dropped, except:
//  * the ones that remove data we already have (so a muted server can still delete its content or undo its likes, follows...)
//  * follows, so the follower gets a Reject instead of a pending follow (see process-follow.ts)
const ACTIVITIES_ALLOWED_FROM_MUTED_SERVERS = new Set<string>([ 'Delete', 'Undo', 'Reject', 'RejectReply', 'Follow' ])

export function isActivityTypeAllowedFromMutedServer (type: string) {
  return ACTIVITIES_ALLOWED_FROM_MUTED_SERVERS.has(type)
}
