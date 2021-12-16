import { Op, QueryTypes } from 'sequelize'
import { BelongsTo, Column, CreatedAt, ForeignKey, Model, Scopes, Table, UpdatedAt } from 'sequelize-typescript'
import { handlesToNameAndHost } from '@server/helpers/actors'
import { MAccountBlocklist, MAccountBlocklistAccounts, MAccountBlocklistFormattable } from '@server/types/models'
import { AttributesOnly } from '@shared/typescript-utils'
import { AccountBlock } from '../../../shared/models'
import { ActorModel } from '../actor/actor'
import { ServerModel } from '../server/server'
import { createSafeIn, getSort, searchAttribute } from '../utils'
import { AccountModel } from './account'

enum ScopeNames {
  WITH_ACCOUNTS = 'WITH_ACCOUNTS'
}

@Scopes(() => ({
  [ScopeNames.WITH_ACCOUNTS]: {
    include: [
      {
        model: AccountModel,
        required: true,
        as: 'ByAccount'
      },
      {
        model: AccountModel,
        required: true,
        as: 'BlockedAccount'
      }
    ]
  }
}))

@Table({
  tableName: 'accountBlocklist',
  indexes: [
    {
      fields: [ 'accountId', 'targetAccountId' ],
      unique: true
    },
    {
      fields: [ 'targetAccountId' ]
    }
  ]
})
export class AccountBlocklistModel extends Model<Partial<AttributesOnly<AccountBlocklistModel>>> {

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
    as: 'ByAccount',
    onDelete: 'CASCADE'
  })
  ByAccount: AccountModel

  @ForeignKey(() => AccountModel)
  @Column
  targetAccountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      name: 'targetAccountId',
      allowNull: false
    },
    as: 'BlockedAccount',
    onDelete: 'CASCADE'
  })
  BlockedAccount: AccountModel

  static isAccountMutedByAccounts (accountIds: number[], targetAccountId: number) {
    const query = {
      attributes: [ 'accountId', 'id' ],
      where: {
        accountId: {
          [Op.in]: accountIds
        },
        targetAccountId
      },
      raw: true
    }

    return AccountBlocklistModel.unscoped()
                                .findAll(query)
                                .then(rows => {
                                  const result: { [accountId: number]: boolean } = {}

                                  for (const accountId of accountIds) {
                                    result[accountId] = !!rows.find(r => r.accountId === accountId)
                                  }

                                  return result
                                })
  }

  static loadByAccountAndTarget (accountId: number, targetAccountId: number): Promise<MAccountBlocklist> {
    const query = {
      where: {
        accountId,
        targetAccountId
      }
    }

    return AccountBlocklistModel.findOne(query)
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
      order: getSort(sort)
    }

    const where = {
      accountId
    }

    if (search) {
      Object.assign(where, {
        [Op.or]: [
          searchAttribute(search, '$BlockedAccount.name$'),
          searchAttribute(search, '$BlockedAccount.Actor.url$')
        ]
      })
    }

    Object.assign(query, { where })

    return AccountBlocklistModel
      .scope([ ScopeNames.WITH_ACCOUNTS ])
      .findAndCountAll<MAccountBlocklistAccounts>(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  static listHandlesBlockedBy (accountIds: number[]): Promise<string[]> {
    const query = {
      attributes: [ 'id' ],
      where: {
        accountId: {
          [Op.in]: accountIds
        }
      },
      include: [
        {
          attributes: [ 'id' ],
          model: AccountModel.unscoped(),
          required: true,
          as: 'BlockedAccount',
          include: [
            {
              attributes: [ 'preferredUsername' ],
              model: ActorModel.unscoped(),
              required: true,
              include: [
                {
                  attributes: [ 'host' ],
                  model: ServerModel.unscoped(),
                  required: true
                }
              ]
            }
          ]
        }
      ]
    }

    return AccountBlocklistModel.findAll(query)
      .then(entries => entries.map(e => `${e.BlockedAccount.Actor.preferredUsername}@${e.BlockedAccount.Actor.Server.host}`))
  }

  static getBlockStatus (byAccountIds: number[], handles: string[]): Promise<{ name: string, host: string, accountId: number }[]> {
    const sanitizedHandles = handlesToNameAndHost(handles)

    const localHandles = sanitizedHandles.filter(h => !h.host)
                                         .map(h => h.name)

    const remoteHandles = sanitizedHandles.filter(h => !!h.host)
                                          .map(h => ([ h.name, h.host ]))

    const handlesWhere: string[] = []

    if (localHandles.length !== 0) {
      handlesWhere.push(`("actor"."preferredUsername" IN (:localHandles) AND "server"."id" IS NULL)`)
    }

    if (remoteHandles.length !== 0) {
      handlesWhere.push(`(("actor"."preferredUsername", "server"."host") IN (:remoteHandles))`)
    }

    const rawQuery = `SELECT "accountBlocklist"."accountId", "actor"."preferredUsername" AS "name", "server"."host" ` +
      `FROM "accountBlocklist" ` +
      `INNER JOIN "account" ON "account"."id" = "accountBlocklist"."targetAccountId" ` +
      `INNER JOIN "actor" ON "actor"."id" = "account"."actorId" ` +
      `LEFT JOIN "server" ON "server"."id" = "actor"."serverId" ` +
      `WHERE "accountBlocklist"."accountId" IN (${createSafeIn(AccountBlocklistModel.sequelize, byAccountIds)}) ` +
      `AND (${handlesWhere.join(' OR ')})`

    return AccountBlocklistModel.sequelize.query(rawQuery, {
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      replacements: { byAccountIds, localHandles, remoteHandles }
    })
  }

  toFormattedJSON (this: MAccountBlocklistFormattable): AccountBlock {
    return {
      byAccount: this.ByAccount.toFormattedJSON(),
      blockedAccount: this.BlockedAccount.toFormattedJSON(),
      createdAt: this.createdAt
    }
  }
}
