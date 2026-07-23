import { AutoMuteAction, AutoMuteList, StreamSyncState } from '@peertube/peertube-models'
import { handleToNameAndHost } from '@server/helpers/actors.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { SCHEDULER_INTERVALS_MS } from '@server/initializers/constants.js'
import { fetchAndValidateAutoMuteList } from '@server/lib/blocklist-subscriptions.js'
import {
  addAccountInBlocklist,
  addServerInBlocklist,
  removeAccountFromBlocklist,
  removeServerFromBlocklist
} from '@server/lib/blocklist.js'
import { AccountModel } from '@server/models/account/account.js'
import { getServerActor } from '@server/models/application/application.js'
import { AccountBlocklistModel } from '@server/models/blocklist/account-blocklist.js'
import { BlocklistSubscriptionModel } from '@server/models/blocklist/blocklist-subscription.js'
import { ServerBlocklistModel } from '@server/models/blocklist/server-blocklist.js'
import { ServerModel } from '@server/models/server/server.js'
import { MBlocklistSubscription } from '@server/types/models/index.js'
import { Notifier } from '../notifier/notifier.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const lTags = loggerTagsFactory('schedulers')

export class BlocklistSubscriptionsScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.BLOCKLIST_SUBSCRIPTIONS_SYNC

  private constructor () {
    super({ randomRunOnEnable: true })
  }

  protected async internalExecute () {
    const serverActor = await getServerActor()

    const subscriptions = await BlocklistSubscriptionModel.listByAccountId(serverActor.Account.id)
    if (subscriptions.length === 0) return

    for (const subscription of subscriptions) {
      try {
        await this.syncSubscription({ subscription, serverAccountId: serverActor.Account.id })
      } catch (err) {
        subscription.update({ state: StreamSyncState.PROCESSING })
          .catch(err =>
            logger.error('Cannot update blocklist subscription state after failed synchronization.', {
              err,
              url: subscription.url,
              ...lTags()
            })
          )

        logger.error('Cannot synchronize blocklist subscription.', { err, url: subscription.url, ...lTags() })
      }
    }
  }

  private async syncSubscription (options: {
    subscription: MBlocklistSubscription
    serverAccountId: number
  }) {
    const { subscription, serverAccountId } = options

    logger.info(`Synchronizing blocklist subscription "${subscription.name}" (${subscription.url}).`, lTags())

    await subscription.update({ state: StreamSyncState.PROCESSING })

    const newLastSyncAt = new Date()

    const body: AutoMuteList = await fetchAndValidateAutoMuteList(subscription.url, subscription.lastActionCreatedAt)

    logger.debug('Fetched blocklist subscription data.', {
      ...lTags(),
      subscriptionUrl: subscription.url,
      actionsCount: body.actions.length
    })

    const actions = body.actions
      .map(action => ({ ...action, createdAtMs: Date.parse(action.createdAt) }))
      .filter(action => {
        if (Number.isNaN(action.createdAtMs)) return false

        if (!subscription.lastActionCreatedAt) return true

        return action.createdAtMs > subscription.lastActionCreatedAt.getTime()
      })
      .sort((a, b) => a.createdAtMs - b.createdAtMs)

    const blockedAccounts = new Set<string>()
    const blockedHosts = new Set<string>()
    const unblockedAccounts = new Set<string>()
    const unblockedHosts = new Set<string>()

    for (const action of actions) {
      const actionResult = await this.handleAction({
        action,
        serverAccountId,
        subscription
      })

      if (!actionResult) continue

      const [ blocked, unblocked ] = actionResult.targetType === 'account'
        ? [ blockedAccounts, unblockedAccounts ]
        : [ blockedHosts, unblockedHosts ]

      if (actionResult.actionType === 'block') {
        if (unblocked.has(action.target)) unblocked.delete(action.target)
        else blocked.add(action.target)
      } else {
        // oxlint-disable-next-line no-lonely-if
        if (blocked.has(action.target)) blocked.delete(action.target)
        else unblocked.add(action.target)
      }
    }

    this.notifyOfAutomaticBlocklistActions({
      block: {
        accountsCount: blockedAccounts.size,
        hostsCount: blockedHosts.size
      },
      unblock: {
        accountsCount: unblockedAccounts.size,
        hostsCount: unblockedHosts.size
      }
    })

    const lastActionCreatedAt = actions.length !== 0
      ? new Date(actions[actions.length - 1].createdAt)
      : subscription.lastActionCreatedAt

    await subscription.update({ name: body.name, lastSyncAt: newLastSyncAt, lastActionCreatedAt, state: StreamSyncState.SYNCED })
  }

  private async handleAction (options: {
    action: AutoMuteAction
    serverAccountId: number
    subscription: MBlocklistSubscription
  }) {
    const { action, serverAccountId, subscription } = options

    if (action.target.includes('@')) {
      return this.handleAccountAction({
        action,
        serverAccountId,
        subscription
      })
    }

    return this.handleServerAction({
      action,
      serverAccountId,
      subscription
    })
  }

  private async handleAccountAction (options: {
    action: AutoMuteAction
    serverAccountId: number
    subscription: MBlocklistSubscription
  }) {
    const { action, serverAccountId, subscription } = options

    const { name, host } = handleToNameAndHost(action.target)

    // TODO: handle actors that are not yet federated
    const account = host
      ? await AccountModel.loadByNameAndHost(name, host)
      : await AccountModel.loadLocalByName(name)

    if (!account) return null

    if (action.type === 'block') {
      const existing = await AccountBlocklistModel.loadByAccountAndTarget(serverAccountId, account.id)
      if (existing) return null

      await addAccountInBlocklist({
        byAccountId: serverAccountId,
        targetAccount: account,
        blocklistSubscription: subscription,
        removeNotificationOfUserId: null
      })
    } else if (action.type === 'unblock') {
      const block = await AccountBlocklistModel.loadByAccountAndTarget(serverAccountId, account.id)
      if (!block || block.blocklistSubscriptionId !== subscription.id) return null

      await removeAccountFromBlocklist(block)
    }

    return {
      actionType: action.type,
      targetType: 'account' as const
    }
  }

  private async handleServerAction (options: {
    action: AutoMuteAction
    serverAccountId: number
    subscription: MBlocklistSubscription
  }) {
    const { action, serverAccountId, subscription } = options

    const server = await ServerModel.loadOrCreateByHost(action.target)

    if (action.type === 'block') {
      const existing = await ServerBlocklistModel.loadByAccountAndHost(serverAccountId, action.target)
      if (existing) return null

      await addServerInBlocklist({
        byAccountId: serverAccountId,
        targetServer: server,
        blocklistSubscription: subscription,
        removeNotificationOfUserId: null
      })
    } else if (action.type === 'unblock') {
      const block = await ServerBlocklistModel.loadByAccountAndHost(serverAccountId, action.target)
      if (!block || block.blocklistSubscriptionId !== subscription.id) return null

      await removeServerFromBlocklist(block)
    }

    return {
      actionType: action.type,
      targetType: 'host' as const
    }
  }

  private notifyOfAutomaticBlocklistActions (stats: {
    block: { accountsCount: number, hostsCount: number }
    unblock: { accountsCount: number, hostsCount: number }
  }) {
    if (
      stats.block.accountsCount === 0 &&
      stats.block.hostsCount === 0 &&
      stats.unblock.accountsCount === 0 &&
      stats.unblock.hostsCount === 0
    ) {
      return
    }

    Notifier.Instance.notifyOfAutomaticBlocklist({
      blockedAccountsCount: stats.block.accountsCount,
      blockedHostsCount: stats.block.hostsCount,
      unblockedAccountsCount: stats.unblock.accountsCount,
      unblockedHostsCount: stats.unblock.hostsCount
    })
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
