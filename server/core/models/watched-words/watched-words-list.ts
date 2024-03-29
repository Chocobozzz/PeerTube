import { WatchedWordsList } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { wordsToRegExp } from '@server/helpers/regexp.js'
import { MAccountId, MWatchedWordsList } from '@server/types/models/index.js'
import { LRUCache } from 'lru-cache'
import { Transaction } from 'sequelize'
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType, ForeignKey, Table,
  UpdatedAt
} from 'sequelize-typescript'
import { LRU_CACHE, USER_EXPORT_MAX_ITEMS } from '../../initializers/constants.js'
import { AccountModel } from '../account/account.js'
import { SequelizeModel, getSort } from '../shared/index.js'

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
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @Column
  listName: string

  @AllowNull(false)
  @Column(DataType.ARRAY(DataType.STRING))
  words: string[]

  @ForeignKey(() => AccountModel)
  @Column
  accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  Account: Awaited<AccountModel>

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
  }) {
    const { listName, accountId } = options

    const query = {
      where: { listName, accountId }
    }

    return this.findOne(query)
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

    const query = {
      offset: start,
      limit: count,
      order: getSort(sort),
      where: { accountId }
    }

    return Promise.all([
      WatchedWordsListModel.count(query),
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

    this.regexCache.set(accountId, result)

    logger.debug('Will cache watched words regex', { accountId, result, tags: [ 'watched-words' ] })

    return result
  }

  static createList (options: {
    accountId: number

    listName: string
    words: string[]
  }) {
    WatchedWordsListModel.regexCache.delete(options.accountId)

    return super.create(options)
  }

  updateList (options: {
    listName: string
    words?: string[]
  }) {
    const { listName, words } = options

    if (words && words.length === 0) {
      throw new Error('Cannot update watched words with an empty list')
    }

    if (words) this.words = words
    if (listName) this.listName = listName

    WatchedWordsListModel.regexCache.delete(this.accountId)

    return this.save()
  }

  destroy () {
    WatchedWordsListModel.regexCache.delete(this.accountId)

    return super.destroy()
  }

  toFormattedJSON (): WatchedWordsList {
    return {
      id: this.id,
      listName: this.listName,
      words: this.words,
      updatedAt: this.updatedAt,
      createdAt: this.createdAt
    }
  }
}
