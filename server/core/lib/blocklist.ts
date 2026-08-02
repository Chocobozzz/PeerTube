import { logger } from '@server/helpers/logger.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { AccountModel } from '@server/models/account/account.js'
import { getServerAccount } from '@server/models/application/application.js'
import { ServerModel } from '@server/models/server/server.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import {
  MAccountBlocklist,
  MAccountDefault,
  MAccountHost,
  MAccountId,
  MBlocklistSubscription,
  MServer,
  MServerBlocklist
} from '@server/types/models/index.js'
import { AccountBlocklistModel } from '../models/blocklist/account-blocklist.js'
import { BlocklistLogModel } from '../models/blocklist/blocklist-log.js'
import { ServerBlocklistModel } from '../models/blocklist/server-blocklist.js'

export async function addAccountInBlocklist (options: {
  byAccountId: number
  targetAccount: MAccountDefault
  blocklistSubscription?: MBlocklistSubscription

  removeNotificationOfUserId: number | null // If blocked by a user
}) {
  const { byAccountId, targetAccount, blocklistSubscription, removeNotificationOfUserId } = options

  await sequelizeTypescript.transaction(async t => {
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

  await sequelizeTypescript.transaction(async t => {
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

  UserNotificationModel.removeNotificationsOf({
    id: targetServer.id,
    type: 'server',
    forUserId: removeNotificationOfUserId
  }).catch(err => logger.error('Cannot remove notifications after a server mute.', { err }))
}

export function removeAccountFromBlocklist (accountBlock: MAccountBlocklist) {
  return sequelizeTypescript.transaction(async t => {
    const targetAccount = await AccountModel.load(accountBlock.targetAccountId, t)

    await BlocklistLogModel.create({
      action: 'delete',
      accountId: accountBlock.accountId,
      blocklistSubscriptionId: accountBlock.blocklistSubscriptionId,
      automaticallyCreated: !!accountBlock.blocklistSubscriptionId,
      target: targetAccount.Actor.getFullIdentifier()
    }, { transaction: t })

    return accountBlock.destroy({ transaction: t })
  })
}

export function removeServerFromBlocklist (serverBlock: MServerBlocklist) {
  return sequelizeTypescript.transaction(async t => {
    const targetServer = await ServerModel.load(serverBlock.targetServerId, t)

    await BlocklistLogModel.create({
      action: 'delete',
      accountId: serverBlock.accountId,
      blocklistSubscriptionId: serverBlock.blocklistSubscriptionId,
      automaticallyCreated: !!serverBlock.blocklistSubscriptionId,
      target: targetServer.host
    }, { transaction: t })

    return serverBlock.destroy({ transaction: t })
  })
}

export async function isBlockedByServerOrAccount (targetAccount: MAccountHost, userAccount?: MAccountId) {
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
