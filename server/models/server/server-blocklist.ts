import * as Bluebird from 'bluebird'
import { Op } from 'sequelize'
import { BelongsTo, Column, CreatedAt, ForeignKey, Model, Scopes, Table, UpdatedAt } from 'sequelize-typescript'
import { MServerBlocklist, MServerBlocklistAccountServer, MServerBlocklistFormattable } from '@server/types/models'
import { ServerBlock } from '@shared/models'
import { AccountModel } from '../account/account'
import { getSort, searchAttribute } from '../utils'
import { ServerModel } from './server'

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
export class ServerBlocklistModel extends Model<ServerBlocklistModel> {

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
  ByAccount: AccountModel

  @ForeignKey(() => ServerModel)
  @Column
  targetServerId: number

  @BelongsTo(() => ServerModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  BlockedServer: ServerModel

  static isServerMutedByMulti (accountIds: number[], targetServerId: number) {
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

  static loadByAccountAndHost (accountId: number, host: string): Bluebird<MServerBlocklist> {
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

  static listHostsBlockedBy (accountIds: number[]): Bluebird<string[]> {
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

    return ServerBlocklistModel
      .scope([ ScopeNames.WITH_ACCOUNT, ScopeNames.WITH_SERVER ])
      .findAndCountAll<MServerBlocklistAccountServer>(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  toFormattedJSON (this: MServerBlocklistFormattable): ServerBlock {
    return {
      byAccount: this.ByAccount.toFormattedJSON(),
      blockedServer: this.BlockedServer.toFormattedJSON(),
      createdAt: this.createdAt
    }
  }
}
