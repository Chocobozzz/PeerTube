import { WatchedWordsList } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { wordsToRegExp } from '@server/helpers/regexp.js'
import { MAccountId, MWatchedWordsList } from '@server/types/models/index.js'
import { LRUCache } from 'lru-cache'
import { Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { LRU_CACHE, USER_EXPORT_MAX_ITEMS } from '../../initializers/constants.js'
import { AccountModel } from '../account/account.js'
import { SequelizeModel, getSort } from '../shared/index.js'
import { WatchedWordsSubscriptionModel } from './watched-words-subscription.js'

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

  static async buildWatchedWordsRegexp (options: {
    accountId: number
    transaction: Transaction
  }) {
    const { accountId, transaction } = options

    if (WatchedWordsListModel.regexCache.has(accountId)) {
      return WatchedWordsListModel.regexCache.get(accountId)
    }

    const models = await WatchedWordsListModel.findAll<MWatchedWordsList>({
      where: { accountId },
      transaction
    })

    const result = models.map(m => ({ listName: m.listName, regex: wordsToRegExp(m.words) }))

    WatchedWordsListModel.regexCache.set(accountId, result)

    logger.debug('Will cache watched words regex', { accountId, listNames: result.map(r => r.listName), tags: [ 'watched-words' ] })

    return result
  }

  static createList (options: {
    accountId: number

    listName: string
    words: string[]
    watchedWordsSubscriptionId?: number

    transaction?: Transaction
  }) {
    WatchedWordsListModel.regexCache.delete(options.accountId)

    return super.create<MWatchedWordsList>(options, { transaction: options.transaction })
  }

  static removeImportedBySubscription (options: {
    accountId: number
    watchedWordsSubscriptionId: number
    transaction?: Transaction
  }) {
    const { accountId, watchedWordsSubscriptionId, transaction } = options

    WatchedWordsListModel.regexCache.delete(accountId)

    return WatchedWordsListModel.destroy({
      where: {
        accountId,
        watchedWordsSubscriptionId
      },
      transaction
    })
  }

  updateList (options: {
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

    WatchedWordsListModel.regexCache.delete(this.accountId)

    return this.save({ transaction })
  }

  destroy (options: {
    transaction?: Transaction
  } = {}) {
    WatchedWordsListModel.regexCache.delete(this.accountId)

    return super.destroy(options)
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
