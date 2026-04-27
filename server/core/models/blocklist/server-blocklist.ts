import { ServerBlock } from '@peertube/peertube-models'
import { MServerBlocklist, MServerBlocklistAccountServer, MServerBlocklistFormattable } from '@server/types/models/index.js'
import { FindOptions, Op, QueryTypes, Transaction } from 'sequelize'
import { BelongsTo, Column, CreatedAt, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { ServerModel } from '../server/server.js'
import { SequelizeModel, createSafeIn, getSort, searchAttribute } from '../shared/index.js'
import { BlocklistSubscriptionModel } from './blocklist-subscription.js'

@Table({
  tableName: 'serverBlocklist',
  indexes: [
    {
      fields: [ 'accountId', 'targetServerId' ],
      unique: true
    },
    {
      fields: [ 'targetServerId' ]
    }
  ]
})
export class ServerBlocklistModel extends SequelizeModel<ServerBlocklistModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

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
  declare ByAccount: Awaited<AccountModel>

  @ForeignKey(() => ServerModel)
  @Column
  declare targetServerId: number

  @BelongsTo(() => ServerModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  declare BlockedServer: Awaited<ServerModel>

  @ForeignKey(() => BlocklistSubscriptionModel)
  @Column
  declare blocklistSubscriptionId: number

  @BelongsTo(() => BlocklistSubscriptionModel, {
    foreignKey: {
      name: 'blocklistSubscriptionId',
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  declare BlocklistSubscription: Awaited<BlocklistSubscriptionModel>

  static isServerMutedByAccounts (accountIds: number[], targetServerId: number) {
    const query = {
      attributes: [ 'accountId', 'id' ],
      where: {
        accountId: {
          [Op.in]: accountIds
        },
        targetServerId
      },
      raw: true
    }

    return ServerBlocklistModel.unscoped()
      .findAll(query)
      .then(rows => {
        const result: { [accountId: number]: boolean } = {}

        for (const accountId of accountIds) {
          result[accountId] = !!rows.find(r => r.accountId === accountId)
        }

        return result
      })
  }

  static loadByAccountAndHost (accountId: number, host: string): Promise<MServerBlocklist> {
    const query = {
      where: {
        accountId
      },
      include: [
        {
          model: ServerModel,
          where: {
            host
          },
          required: true
        }
      ]
    }

    return ServerBlocklistModel.findOne(query)
  }

  static loadByAccountAndTarget (accountId: number, targetServerId: number, transaction?: Transaction): Promise<MServerBlocklist> {
    const query = {
      where: {
        accountId,
        targetServerId
      }
    }

    return ServerBlocklistModel.findOne(query)
  }

  static listHostsBlockedBy (accountIds: number[]): Promise<string[]> {
    const query = {
      attributes: [],
      where: {
        accountId: {
          [Op.in]: accountIds
        }
      },
      include: [
        {
          attributes: [ 'host' ],
          model: ServerModel.unscoped(),
          required: true
        }
      ]
    }

    return ServerBlocklistModel.findAll(query)
      .then(entries => entries.map(e => e.BlockedServer.host))
  }

  static getBlockStatus (
    byAccountIds: number[],
    hosts: string[]
  ): Promise<{ host: string, accountId: number, blocklistSubscriptionName: string }[]> {
    const rawQuery =
      `SELECT "server"."host", "serverBlocklist"."accountId", "blocklistSubscription"."name" as "blocklistSubscriptionName" ` +
      `FROM "serverBlocklist" ` +
      `INNER JOIN "server" ON "server"."id" = "serverBlocklist"."targetServerId" ` +
      `LEFT JOIN "blocklistSubscription" ON "serverBlocklist"."blocklistSubscriptionId" = "blocklistSubscription"."id" ` +
      `WHERE "server"."host" IN (:hosts) ` +
      `AND "serverBlocklist"."accountId" IN (${createSafeIn(ServerBlocklistModel.sequelize, byAccountIds)})`

    return ServerBlocklistModel.sequelize.query(rawQuery, {
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      replacements: { hosts }
    })
  }

  static listForApi (parameters: {
    start: number
    count: number
    sort: string
    search?: string
    subscriptionName?: string
    accountId: number
  }) {
    const { start, count, sort, search, subscriptionName, accountId } = parameters

    const baseQuery: FindOptions = {
      offset: start,
      limit: count,
      order: getSort(sort),
      where: {
        accountId,

        ...searchAttribute(search, '$BlockedServer.host$')
      }
    }

    const withSubscriptionFilter = subscriptionName
      ? {
        model: BlocklistSubscriptionModel,
        required: true,
        where: { name: subscriptionName }
      }
      : {
        model: BlocklistSubscriptionModel,
        required: false
      }

    return Promise.all([
      ServerBlocklistModel.count({
        ...baseQuery,

        include: [
          {
            model: ServerModel,
            required: true
          },
          withSubscriptionFilter
        ]
      }),

      ServerBlocklistModel.findAll<MServerBlocklistAccountServer>({
        ...baseQuery,

        include: [
          {
            model: AccountModel,
            required: true
          },
          {
            model: ServerModel,
            required: true
          },

          withSubscriptionFilter
        ]
      })
    ]).then(([ total, data ]) => ({ total, data }))
  }

  toFormattedJSON (this: MServerBlocklistFormattable): ServerBlock {
    return {
      byAccount: this.ByAccount.toFormattedJSON(),
      blockedServer: this.BlockedServer.toFormattedJSON(),
      blocklistSubscription: this.BlocklistSubscription
        ? this.BlocklistSubscription.toFormattedSummaryJSON()
        : null,
      createdAt: this.createdAt
    }
  }
}
