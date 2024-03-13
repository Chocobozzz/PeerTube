import { FindOptions, Op, QueryTypes } from 'sequelize'
import { BelongsTo, Column, CreatedAt, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountBlock } from '@peertube/peertube-models'
import { handlesToNameAndHost } from '@server/helpers/actors.js'
import { MAccountBlocklist, MAccountBlocklistFormattable } from '@server/types/models/index.js'
import { ActorModel } from '../actor/actor.js'
import { ServerModel } from '../server/server.js'
import { SequelizeModel, createSafeIn, getSort, searchAttribute } from '../shared/index.js'
import { AccountModel } from './account.js'
import { WEBSERVER } from '@server/initializers/constants.js'

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
export class AccountBlocklistModel extends SequelizeModel<AccountBlocklistModel> {

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
  ByAccount: Awaited<AccountModel>

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
  BlockedAccount: Awaited<AccountModel>

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

    const getQuery = (forCount: boolean) => {
      const query: FindOptions = {
        offset: start,
        limit: count,
        order: getSort(sort),
        where: { accountId }
      }

      if (search) {
        Object.assign(query.where, {
          [Op.or]: [
            searchAttribute(search, '$BlockedAccount.name$'),
            searchAttribute(search, '$BlockedAccount.Actor.url$')
          ]
        })
      }

      if (forCount !== true) {
        query.include = [
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
      } else if (search) { // We need some joins when counting with search
        query.include = [
          {
            model: AccountModel.unscoped(),
            required: true,
            as: 'BlockedAccount',
            include: [
              {
                model: ActorModel.unscoped(),
                required: true
              }
            ]
          }
        ]
      }

      return query
    }

    return Promise.all([
      AccountBlocklistModel.count(getQuery(true)),
      AccountBlocklistModel.findAll(getQuery(false))
    ]).then(([ total, data ]) => ({ total, data }))
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
                  required: false
                }
              ]
            }
          ]
        }
      ]
    }

    return AccountBlocklistModel.findAll(query)
      .then(entries => {
        return entries.map(e => {
          const host = e.BlockedAccount.Actor.Server?.host ?? WEBSERVER.HOST

          return `${e.BlockedAccount.Actor.preferredUsername}@${host}`
        })
      })
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
