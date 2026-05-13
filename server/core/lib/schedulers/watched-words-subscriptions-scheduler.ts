import {
  StreamSyncState,
  StreamSyncStateType,
  WatchedWordsSubscriptionAction,
  WatchedWordsSubscriptionActions
} from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { CONSTRAINTS_FIELDS, SCHEDULER_INTERVALS_MS } from '@server/initializers/constants.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { fetchAndValidateWatchedWordsSubscriptionActions } from '@server/lib/watched-words-subscriptions.js'
import { WatchedWordsListModel } from '@server/models/watched-words/watched-words-list.js'
import { WatchedWordsSubscriptionModel } from '@server/models/watched-words/watched-words-subscription.js'
import { MWatchedWordsSubscription } from '@server/types/models/index.js'
import { createRebuildAutomaticTagsJob } from '../automatic-tags/automatic-tags.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const lTags = loggerTagsFactory('schedulers')

export class WatchedWordsSubscriptionsScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.WATCHED_WORDS_SUBSCRIPTIONS_SYNC

  private constructor () {
    super({ randomRunOnEnable: true })
  }

  protected async internalExecute () {
    const subscriptions = await WatchedWordsSubscriptionModel.findAll<MWatchedWordsSubscription>()
    if (subscriptions.length === 0) return

    for (const subscription of subscriptions) {
      try {
        await this.syncSubscription(subscription)
      } catch (err) {
        await subscription.update({ state: StreamSyncState.FAILED })

        logger.error('Cannot synchronize watched words subscription.', {
          err,
          url: subscription.url,
          subscriptionId: subscription.id,
          ...lTags()
        })
      }
    }
  }

  private async syncSubscription (subscription: MWatchedWordsSubscription) {
    logger.info(`Synchronizing watched words subscription "${subscription.name}" (${subscription.url}).`, lTags())

    await subscription.update({ state: StreamSyncState.PROCESSING })

    const body: WatchedWordsSubscriptionActions = await fetchAndValidateWatchedWordsSubscriptionActions(
      subscription.url,
      subscription.lastActionCreatedAt
    )

    const actions = body.actions
      .map(action => ({ ...action, createdAtMs: Date.parse(action.createdAt) }))
      .filter(action => {
        if (Number.isNaN(action.createdAtMs)) return false

        if (!subscription.lastActionCreatedAt) return true

        return action.createdAtMs > subscription.lastActionCreatedAt.getTime()
      })
      .sort((a, b) => a.createdAtMs - b.createdAtMs)

    const state = await this.handleActions({ actions, subscription, listName: body.name })

    const lastActionCreatedAt = actions.length !== 0
      ? new Date(actions[actions.length - 1].createdAt)
      : subscription.lastActionCreatedAt

    await subscription.update({
      name: body.name,
      lastSyncAt: new Date(),
      lastActionCreatedAt,
      state
    })
  }

  private async handleActions (options: {
    actions: WatchedWordsSubscriptionAction[]
    subscription: MWatchedWordsSubscription
    listName: string
  }): Promise<StreamSyncStateType> {
    const { actions, subscription, listName } = options

    let shouldRebuildAutomaticTags = false

    await sequelizeTypescript.transaction(async transaction => {
      const existing = await WatchedWordsListModel.loadByListName({
        accountId: subscription.accountId,
        listName,
        transaction
      })

      let list = await WatchedWordsListModel.loadBySubscriptionId({
        accountId: subscription.accountId,
        watchedWordsSubscriptionId: subscription.id,
        transaction
      })

      if (existing && (!list || list.id !== existing.id)) {
        logger.error(
          'Cannot create/update watched words list for subscription: a list with the same name already exists for this account',
          {
            accountId: subscription.accountId,
            subscriptionId: subscription.id,
            listName,
            existingListId: existing.id,
            ...lTags()
          }
        )
        return StreamSyncState.FAILED
      }

      if (actions.length === 0) {
        if (list && list.listName !== listName) {
          shouldRebuildAutomaticTags = true

          list.listName = listName
          await list.save({ transaction })
        }

        return StreamSyncState.SYNCED
      }

      shouldRebuildAutomaticTags = true

      if (!list) {
        list = await WatchedWordsListModel.createList({
          accountId: subscription.accountId,
          listName,
          watchedWordsSubscriptionId: subscription.id,
          words: [],
          transaction
        })
      }

      const wordsSet = new Set(list.words)

      for (const action of actions) {
        if (action.type === 'add') wordsSet.add(action.word)
        else wordsSet.delete(action.word)
      }

      if (wordsSet.size === 0) {
        return list.destroy({ transaction })
      }

      if (wordsSet.size > CONSTRAINTS_FIELDS.WATCHED_WORDS.WORDS.max) {
        logger.error('Cannot synchronize watched words subscription: too many items in watched words list.', {
          accountId: subscription.accountId,
          subscriptionId: subscription.id,
          listName,
          maxItems: CONSTRAINTS_FIELDS.WATCHED_WORDS.WORDS.max,
          itemsToStore: wordsSet.size,
          ...lTags()
        })

        return StreamSyncState.FAILED
      }

      await list.updateList({ listName, words: Array.from(wordsSet), transaction })
    })

    if (shouldRebuildAutomaticTags) {
      await createRebuildAutomaticTagsJob({ accountId: subscription.accountId })
    }

    return StreamSyncState.SYNCED
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
