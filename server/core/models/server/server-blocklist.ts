import { Op, QueryTypes } from 'sequelize'
import { BelongsTo, Column, CreatedAt, ForeignKey, Scopes, Table, UpdatedAt } from 'sequelize-typescript'
import { MServerBlocklist, MServerBlocklistAccountServer, MServerBlocklistFormattable } from '@server/types/models/index.js'
import { ServerBlock } from '@peertube/peertube-models'
import { AccountModel } from '../account/account.js'
import { SequelizeModel, createSafeIn, getSort, searchAttribute } from '../shared/index.js'
import { ServerModel } from './server.js'

enum ScopeNames {
  WITH_ACCOUNT = 'WITH_ACCOUNT',
  WITH_SERVER = 'WITH_SERVER'
}

@Scopes(() => ({
  [ScopeNames.WITH_ACCOUNT]: {
    include: [
      {
        model: AccountModel,
        required: true
      }
    ]
  },
  [ScopeNames.WITH_SERVER]: {
    include: [
      {
        model: ServerModel,
        required: true
      }
    ]
  }
}))

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
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => AccountModel)
  @Column
  accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      name: 'accountId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  ByAccount: Awaited<AccountModel>

  @ForeignKey(() => ServerModel)
  @Column
  targetServerId: number

  @BelongsTo(() => ServerModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  BlockedServer: Awaited<ServerModel>

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

  static listHostsBlockedBy (accountIds: number[]): Promise<string[]> {
    const query = {
      attributes: [ ],
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

  static getBlockStatus (byAccountIds: number[], hosts: string[]): Promise<{ host: string, accountId: number }[]> {
    const rawQuery = `SELECT "server"."host", "serverBlocklist"."accountId" ` +
      `FROM "serverBlocklist" ` +
      `INNER JOIN "server" ON "server"."id" = "serverBlocklist"."targetServerId" ` +
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
    accountId: number
  }) {
    const { start, count, sort, search, accountId } = parameters

    const query = {
      offset: start,
      limit: count,
      order: getSort(sort),
      where: {
        accountId,

        ...searchAttribute(search, '$BlockedServer.host$')
      }
    }

    return Promise.all([
      ServerBlocklistModel.scope(ScopeNames.WITH_SERVER).count(query),
      ServerBlocklistModel.scope([ ScopeNames.WITH_ACCOUNT, ScopeNames.WITH_SERVER ]).findAll<MServerBlocklistAccountServer>(query)
    ]).then(([ total, data ]) => ({ total, data }))
  }

  toFormattedJSON (this: MServerBlocklistFormattable): ServerBlock {
    return {
      byAccount: this.ByAccount.toFormattedJSON(),
      blockedServer: this.BlockedServer.toFormattedJSON(),
      createdAt: this.createdAt
    }
  }
}
