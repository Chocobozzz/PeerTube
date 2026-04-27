import { BlocklistSubscription, StreamSyncState, type StreamSyncStateType } from '@peertube/peertube-models'
import { MBlocklistSubscription } from '@server/types/models/index.js'
import { FindOptions, literal, Op } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, Default, ForeignKey, HasMany, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { getSort, searchAttribute, SequelizeModel } from '../shared/index.js'
import { AccountBlocklistModel } from './account-blocklist.js'
import { BlocklistLogModel } from './blocklist-log.js'
import { ServerBlocklistModel } from './server-blocklist.js'
import { STREAM_SYNC_STATE } from '@server/initializers/constants.js'

@Table({
  tableName: 'blocklistSubscription',
  indexes: [
    {
      fields: [ 'accountId', 'url' ],
      unique: true
    }
  ]
})
export class BlocklistSubscriptionModel extends SequelizeModel<BlocklistSubscriptionModel> {
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

  declare mutedAccountsCount: number
  declare mutedServersCount: number

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

  @HasMany(() => AccountBlocklistModel, {
    foreignKey: {
      name: 'blocklistSubscriptionId',
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  declare AccountBlocklists: Awaited<AccountBlocklistModel[]>

  @HasMany(() => ServerBlocklistModel, {
    foreignKey: {
      name: 'blocklistSubscriptionId',
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  declare ServerBlocklists: Awaited<ServerBlocklistModel[]>

  @HasMany(() => BlocklistLogModel, {
    foreignKey: {
      name: 'blocklistSubscriptionId',
      allowNull: true
    },
    onDelete: 'SET NULL'
  })
  declare BlocklistLogs: Awaited<BlocklistLogModel[]>

  static loadById (id: number) {
    return BlocklistSubscriptionModel.findByPk<MBlocklistSubscription>(id)
  }

  static loadByUrl (options: {
    accountId: number
    url: string
  }) {
    return BlocklistSubscriptionModel.findOne<MBlocklistSubscription>({
      where: {
        url: options.url,
        accountId: options.accountId
      }
    })
  }

  static listByAccountId (accountId: number) {
    return BlocklistSubscriptionModel.findAll<MBlocklistSubscription>({
      where: {
        accountId
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
              '(' +
                'SELECT COUNT(*) ' +
                'FROM "accountBlocklist" ' +
                'INNER JOIN "blocklistSubscription" ON "blocklistSubscription"."id" = "accountBlocklist"."blocklistSubscriptionId" ' +
                'WHERE "blocklistSubscription"."id" = "BlocklistSubscriptionModel"."id"' +
                ')'
            ),
            'mutedAccountsCount'
          ],
          [
            literal(
              '(' +
                'SELECT COUNT(*) ' +
                'FROM "serverBlocklist" ' +
                'INNER JOIN "blocklistSubscription" ON "blocklistSubscription"."id" = "serverBlocklist"."blocklistSubscriptionId" ' +
                'WHERE "blocklistSubscription"."id" = "BlocklistSubscriptionModel"."id"' +
                ')'
            ),
            'mutedServersCount'
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
      BlocklistSubscriptionModel.count(countQuery),
      BlocklistSubscriptionModel.findAll<MBlocklistSubscription>(findQuery)
    ]).then(([ total, data ]) => ({ total, data }))
  }

  toFormattedSummaryJSON (this: MBlocklistSubscription) {
    return {
      id: this.id,
      name: this.name,
      url: this.url
    }
  }

  toFormattedJSON (this: MBlocklistSubscription): BlocklistSubscription {
    const mutedAccountsCount = this.getDataValue('mutedAccountsCount') ?? 0
    const mutedServersCount = this.getDataValue('mutedServersCount') ?? 0

    return {
      id: this.id,
      name: this.name,
      url: this.url,
      mutedAccountsCount,
      mutedServersCount,
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
