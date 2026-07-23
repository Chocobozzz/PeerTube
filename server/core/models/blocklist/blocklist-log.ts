import type { BlocklistLog, BlocklistLogAction } from '@peertube/peertube-models'
import { MBlocklistLog } from '@server/types/models/index.js'
import { FindOptions, Op } from 'sequelize'
import { BelongsTo, Column, CreatedAt, DataType, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { getSort, SequelizeModel } from '../shared/index.js'
import { BlocklistSubscriptionModel } from './blocklist-subscription.js'

@Table({
  tableName: 'blocklistLog',
  indexes: [
    {
      fields: [ 'accountId' ]
    },
    {
      fields: [ 'createdAt' ]
    },
    {
      fields: [ 'blocklistSubscriptionId' ]
    }
  ]
})
export class BlocklistLogModel extends SequelizeModel<BlocklistLogModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @Column(DataType.ENUM('add', 'delete'))
  declare action: BlocklistLogAction

  @Column
  declare automaticallyCreated: boolean

  @ForeignKey(() => AccountModel)
  @Column
  declare accountId: number | null

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      name: 'accountId',
      allowNull: true
    },
    onDelete: 'SET NULL'
  })
  declare Account: Awaited<AccountModel>

  @ForeignKey(() => BlocklistSubscriptionModel)
  @Column
  declare blocklistSubscriptionId: number | null

  @BelongsTo(() => BlocklistSubscriptionModel, {
    foreignKey: {
      name: 'blocklistSubscriptionId',
      allowNull: true
    },
    onDelete: 'SET NULL'
  })
  declare BlocklistSubscription: Awaited<BlocklistSubscriptionModel>

  @Column
  declare target: string

  static listPublicForApi (parameters: {
    accountId: number
    startDate: string
    start: number
    count: number
    sort: string
  }) {
    const { accountId, startDate, start, count, sort } = parameters

    const query: FindOptions = {
      offset: start,
      limit: count,
      order: getSort(sort),
      where: {
        accountId,
        automaticallyCreated: false,

        ...(startDate ?
          {
            createdAt: {
              [Op.gte]: new Date(startDate)
            }
          } :
          {})
      }
    }

    return Promise.all([
      BlocklistLogModel.count(query),
      BlocklistLogModel.findAll<MBlocklistLog>(query)
    ]).then(([ total, data ]) => ({ total, data }))
  }

  toFormattedJSON (this: MBlocklistLog): BlocklistLog {
    return {
      id: this.id,
      action: this.action,
      target: this.target,
      createdAt: this.createdAt
    }
  }
}
