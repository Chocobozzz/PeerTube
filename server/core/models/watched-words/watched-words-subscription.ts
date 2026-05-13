import { StreamSyncState, type StreamSyncStateType, WatchedWordsSubscription } from '@peertube/peertube-models'
import { STREAM_SYNC_STATE } from '@server/initializers/constants.js'
import { MWatchedWordsSubscription } from '@server/types/models/index.js'
import { FindOptions, literal, Op } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, Default, ForeignKey, HasMany, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { getSort, searchAttribute, SequelizeModel } from '../shared/index.js'
import { WatchedWordsListModel } from './watched-words-list.js'

@Table({
  tableName: 'watchedWordsSubscription',
  indexes: [
    {
      fields: [ 'accountId', 'url' ],
      unique: true
    }
  ]
})
export class WatchedWordsSubscriptionModel extends SequelizeModel<WatchedWordsSubscriptionModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @AllowNull(false)
  @Column
  declare name: string

  @AllowNull(false)
  @Column
  declare url: string

  @Column
  declare lastSyncAt: Date | null

  @Column
  declare lastActionCreatedAt: Date | null

  @AllowNull(false)
  @Default(StreamSyncState.WAITING_FIRST_RUN)
  @Column
  declare state: StreamSyncStateType

  declare importedWordsCount: number

  @ForeignKey(() => AccountModel)
  @Column
  declare accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      name: 'accountId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  declare Account: Awaited<AccountModel>

  @HasMany(() => WatchedWordsListModel, {
    foreignKey: {
      name: 'watchedWordsSubscriptionId',
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  declare WatchedWordsLists: Awaited<WatchedWordsListModel[]>

  static loadById (id: number) {
    return WatchedWordsSubscriptionModel.findByPk<MWatchedWordsSubscription>(id)
  }

  static loadByUrl (options: {
    accountId: number
    url: string
  }) {
    return WatchedWordsSubscriptionModel.findOne<MWatchedWordsSubscription>({
      where: {
        url: options.url,
        accountId: options.accountId
      }
    })
  }

  static listForApi (parameters: {
    accountId: number
    start: number
    count: number
    sort: string
    search?: string
  }) {
    const { start, count, sort, search, accountId } = parameters

    const where = {
      accountId,

      ...(search
        ? {
          [Op.or]: [
            searchAttribute(search, 'name'),
            searchAttribute(search, 'url')
          ]
        }
        : {})
    }

    const findQuery: FindOptions = {
      attributes: {
        include: [
          [
            literal(
              'COALESCE((' +
                'SELECT SUM(cardinality("watchedWordsList"."words")) ' +
                'FROM "watchedWordsList" ' +
                'WHERE "watchedWordsList"."watchedWordsSubscriptionId" = "WatchedWordsSubscriptionModel"."id"' +
                '), 0)'
            ),
            'importedWordsCount'
          ]
        ]
      },
      offset: start,
      limit: count,
      order: getSort(sort),
      where
    }

    const countQuery = { where }

    return Promise.all([
      WatchedWordsSubscriptionModel.count(countQuery),
      WatchedWordsSubscriptionModel.findAll<MWatchedWordsSubscription>(findQuery)
    ]).then(([ total, data ]) => ({ total, data }))
  }

  toFormattedSummaryJSON (this: MWatchedWordsSubscription) {
    return {
      id: this.id,
      name: this.name,
      url: this.url
    }
  }

  toFormattedJSON (this: MWatchedWordsSubscription): WatchedWordsSubscription {
    const importedWordsCount = Number(this.getDataValue('importedWordsCount') ?? 0)

    return {
      id: this.id,
      name: this.name,
      url: this.url,
      importedWordsCount,
      lastSyncAt: this.lastSyncAt,
      state: {
        id: this.state,
        label: STREAM_SYNC_STATE[this.state]
      },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
