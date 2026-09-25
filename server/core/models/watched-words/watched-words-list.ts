import { WatchedWordsList } from '@peertube/peertube-models'
import { afterCommitIfTransaction } from '@server/helpers/database-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { wordsToRegExp } from '@server/helpers/regexp.js'
import { RedisChannels } from '@server/lib/redis/index.js'
import { MAccountId, MWatchedWordsList } from '@server/types/models/index.js'
import { LRUCache } from 'lru-cache'
import { Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { LRU_CACHE, USER_EXPORT_MAX_ITEMS } from '../../initializers/constants.js'
import { AccountModel } from '../account/account.js'
import { SequelizeModel, getSort } from '../shared/index.js'
import { WatchedWordsSubscriptionModel } from './watched-words-subscription.js'

const logger = createLogger()

@Table({
  tableName: 'watchedWordsList',
  indexes: [
    {
      fields: [ 'listName', 'accountId' ],
      unique: true
    },
    {
      fields: [ 'accountId' ]
    }
  ]
})
export class WatchedWordsListModel extends SequelizeModel<WatchedWordsListModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @AllowNull(false)
  @Column
  declare listName: string

  @AllowNull(false)
  @Column(DataType.ARRAY(DataType.STRING))
  declare words: string[]

  @ForeignKey(() => AccountModel)
  @Column
  declare accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  declare Account: Awaited<AccountModel>

  @ForeignKey(() => WatchedWordsSubscriptionModel)
  @AllowNull(true)
  @Column
  declare watchedWordsSubscriptionId: number

  @BelongsTo(() => WatchedWordsSubscriptionModel, {
    foreignKey: {
      name: 'watchedWordsSubscriptionId',
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  declare WatchedWordsSubscription: Awaited<WatchedWordsSubscriptionModel>

  // accountId => reg expressions
  private static readonly regexCache = new LRUCache<number, { listName: string, regex: RegExp }[]>({
    max: LRU_CACHE.WATCHED_WORDS_REGEX.MAX_SIZE,
    ttl: LRU_CACHE.WATCHED_WORDS_REGEX.TTL
  })

  // Bumped on each invalidation, so a regex build that overlapped one doesn't cache rows loaded before the change
  private static regexCacheInvalidations = 0

  // Keep in sync with the changes made by the other processes of this platform
  static async listenForRegexCacheInvalidations () {
    await RedisChannels.watchedWordsInvalidation.subscribe(payload => {
      if (payload?.accountId) WatchedWordsListModel.clearLocalRegexCache(payload.accountId)
    })
  }

  static clearLocalRegexCache (accountId: number) {
    WatchedWordsListModel.regexCacheInvalidations++
    WatchedWordsListModel.regexCache.delete(accountId)
  }

  static load (options: {
    id: number
    accountId: number
  }) {
    const { id, accountId } = options

    const query = {
      where: { id, accountId }
    }

    return this.findOne(query)
  }

  static loadByListName (options: {
    listName: string
    accountId: number
    watchedWordsSubscriptionId?: number | null
    transaction?: Transaction
  }) {
    const { listName, accountId, watchedWordsSubscriptionId, transaction } = options

    const query = {
      where: {
        listName,
        accountId,

        ...(watchedWordsSubscriptionId !== undefined
          ? { watchedWordsSubscriptionId }
          : {})
      },
      transaction
    }

    return this.findOne(query)
  }

  static loadBySubscriptionId (options: {
    accountId: number
    watchedWordsSubscriptionId: number
    transaction: Transaction
  }) {
    const { accountId, watchedWordsSubscriptionId, transaction } = options

    return this.findOne<MWatchedWordsList>({
      where: {
        accountId,
        watchedWordsSubscriptionId
      },
      transaction
    })
  }

  // ---------------------------------------------------------------------------

  static listNamesOf (account: MAccountId) {
    const query = {
      raw: true,
      attributes: [ 'listName' ],
      where: { accountId: account.id }
    }

    return WatchedWordsListModel.findAll(query)
      .then(rows => rows.map(r => r.listName))
  }

  static listForAPI (options: {
    accountId: number
    start: number
    count: number
    sort: string
  }) {
    const { accountId, start, count, sort } = options

    const countQuery = {
      where: { accountId }
    }

    const query = {
      offset: start,
      limit: count,
      order: getSort(sort),
      include: [
        {
          model: WatchedWordsSubscriptionModel.unscoped(),
          required: false,
          attributes: [ 'url' ]
        }
      ],
      where: { accountId }
    }

    return Promise.all([
      WatchedWordsListModel.count(countQuery),
      WatchedWordsListModel.findAll(query)
    ]).then(([ total, data ]) => ({ total, data }))
  }

  static listForExport (options: {
    accountId: number
  }) {
    const { accountId } = options

    return WatchedWordsListModel.findAll({
      limit: USER_EXPORT_MAX_ITEMS,
      order: getSort('createdAt'),
      where: { accountId }
    })
  }

  // ---------------------------------------------------------------------------

  // Automatic tags are never built inside a transaction, so this doesn't take one
  static async buildWatchedWordsRegexp (options: {
    accountId: number
  }) {
    const { accountId } = options

    if (WatchedWordsListModel.regexCache.has(accountId)) {
      return WatchedWordsListModel.regexCache.get(accountId)
    }

    const invalidationsBefore = WatchedWordsListModel.regexCacheInvalidations

    const models = await WatchedWordsListModel.findAll<MWatchedWordsList>({
      where: { accountId }
    })

    const result = models.map(m => ({ listName: m.listName, regex: wordsToRegExp(m.words) }))

    if (invalidationsBefore === WatchedWordsListModel.regexCacheInvalidations) {
      WatchedWordsListModel.regexCache.set(accountId, result)

      logger.debug('Will cache watched words regex', { accountId, listNames: result.map(r => r.listName), tags: [ 'watched-words' ] })
    }

    return result
  }

  static async createList (options: {
    accountId: number

    listName: string
    words: string[]
    watchedWordsSubscriptionId?: number

    transaction?: Transaction
  }) {
    const list = await super.create<MWatchedWordsList>(options, { transaction: options.transaction })

    WatchedWordsListModel.invalidateRegexCache(options.accountId, options.transaction)

    return list
  }

  static async removeImportedBySubscription (options: {
    accountId: number
    watchedWordsSubscriptionId: number
    transaction?: Transaction
  }) {
    const { accountId, watchedWordsSubscriptionId, transaction } = options

    const destroyed = await WatchedWordsListModel.destroy({
      where: {
        accountId,
        watchedWordsSubscriptionId
      },
      transaction
    })

    WatchedWordsListModel.invalidateRegexCache(accountId, transaction)

    return destroyed
  }

  // The regex cache is local to the process, so the other processes of this platform must also drop the entry
  // Once the transaction is committed, otherwise they could cache the old rows again
  private static invalidateRegexCache (accountId: number, transaction: Transaction) {
    afterCommitIfTransaction(transaction, () => {
      WatchedWordsListModel.clearLocalRegexCache(accountId)

      RedisChannels.watchedWordsInvalidation.broadcast({ accountId })
    })
  }

  async updateList (options: {
    listName: string
    words?: string[]
    transaction?: Transaction
  }) {
    const { listName, words, transaction } = options

    if (words?.length === 0) {
      throw new Error('Cannot update watched words with an empty list')
    }

    if (words) this.words = words
    if (listName) this.listName = listName

    await this.save({ transaction })

    WatchedWordsListModel.invalidateRegexCache(this.accountId, transaction)
  }

  async destroy (options: {
    transaction?: Transaction
  } = {}) {
    await super.destroy(options)

    WatchedWordsListModel.invalidateRegexCache(this.accountId, options.transaction)
  }

  toFormattedJSON (): WatchedWordsList {
    return {
      id: this.id,
      listName: this.listName,
      words: this.words,
      subscriptionUrl: this.WatchedWordsSubscription?.url ?? null,
      updatedAt: this.updatedAt,
      createdAt: this.createdAt
    }
  }
}
