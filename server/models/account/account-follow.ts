import * as Bluebird from 'bluebird'
import { values } from 'lodash'
import * as Sequelize from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { FollowState } from '../../../shared/models/accounts'
import { FOLLOW_STATES } from '../../initializers/constants'
import { ServerModel } from '../server/server'
import { getSort } from '../utils'
import { AccountModel } from './account'

@Table({
  tableName: 'accountFollow',
  indexes: [
    {
      fields: [ 'accountId' ]
    },
    {
      fields: [ 'targetAccountId' ]
    },
    {
      fields: [ 'accountId', 'targetAccountId' ],
      unique: true
    }
  ]
})
export class AccountFollowModel extends Model<AccountFollowModel> {

  @AllowNull(false)
  @Column(DataType.ENUM(values(FOLLOW_STATES)))
  state: FollowState

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
    as: 'AccountFollower',
    onDelete: 'CASCADE'
  })
  AccountFollower: AccountModel

  @ForeignKey(() => AccountModel)
  @Column
  targetAccountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      name: 'targetAccountId',
      allowNull: false
    },
    as: 'AccountFollowing',
    onDelete: 'CASCADE'
  })
  AccountFollowing: AccountModel

  static loadByAccountAndTarget (accountId: number, targetAccountId: number, t?: Sequelize.Transaction) {
    const query = {
      where: {
        accountId,
        targetAccountId
      },
      include: [
        {
          model: AccountModel,
          required: true,
          as: 'AccountFollower'
        },
        {
          model: AccountModel,
          required: true,
          as: 'AccountFollowing'
        }
      ],
      transaction: t
    }

    return AccountFollowModel.findOne(query)
  }

  static listFollowingForApi (id: number, start: number, count: number, sort: string) {
    const query = {
      distinct: true,
      offset: start,
      limit: count,
      order: [ getSort(sort) ],
      include: [
        {
          model: AccountModel,
          required: true,
          as: 'AccountFollower',
          where: {
            id
          }
        },
        {
          model: AccountModel,
          as: 'AccountFollowing',
          required: true,
          include: [ ServerModel ]
        }
      ]
    }

    return AccountFollowModel.findAndCountAll(query)
      .then(({ rows, count }) => {
        return {
          data: rows,
          total: count
        }
      })
  }

  static listFollowersForApi (id: number, start: number, count: number, sort: string) {
    const query = {
      distinct: true,
      offset: start,
      limit: count,
      order: [ getSort(sort) ],
      include: [
        {
          model: AccountModel,
          required: true,
          as: 'AccountFollower',
          include: [ ServerModel ]
        },
        {
          model: AccountModel,
          as: 'AccountFollowing',
          required: true,
          where: {
            id
          }
        }
      ]
    }

    return AccountFollowModel.findAndCountAll(query)
      .then(({ rows, count }) => {
        return {
          data: rows,
          total: count
        }
      })
  }

  static listAcceptedFollowerUrlsForApi (accountIds: number[], t: Sequelize.Transaction, start?: number, count?: number) {
    return AccountFollowModel.createListAcceptedFollowForApiQuery('followers', accountIds, t, start, count)
  }

  static listAcceptedFollowerSharedInboxUrls (accountIds: number[], t: Sequelize.Transaction) {
    return AccountFollowModel.createListAcceptedFollowForApiQuery('followers', accountIds, t, undefined, undefined, 'sharedInboxUrl')
  }

  static listAcceptedFollowingUrlsForApi (accountIds: number[], t: Sequelize.Transaction, start?: number, count?: number) {
    return AccountFollowModel.createListAcceptedFollowForApiQuery('following', accountIds, t, start, count)
  }

  private static async createListAcceptedFollowForApiQuery (type: 'followers' | 'following',
                                       accountIds: number[],
                                       t: Sequelize.Transaction,
                                       start?: number,
                                       count?: number,
                                       columnUrl = 'url') {
    let firstJoin: string
    let secondJoin: string

    if (type === 'followers') {
      firstJoin = 'targetAccountId'
      secondJoin = 'accountId'
    } else {
      firstJoin = 'accountId'
      secondJoin = 'targetAccountId'
    }

    const selections = [ '"Follows"."' + columnUrl + '" AS "url"', 'COUNT(*) AS "total"' ]
    const tasks: Bluebird<any>[] = []

    for (const selection of selections) {
      let query = 'SELECT ' + selection + ' FROM "account" ' +
        'INNER JOIN "accountFollow" ON "accountFollow"."' + firstJoin + '" = "account"."id" ' +
        'INNER JOIN "account" AS "Follows" ON "accountFollow"."' + secondJoin + '" = "Follows"."id" ' +
        'WHERE "account"."id" = ANY ($accountIds) AND "accountFollow"."state" = \'accepted\' '

      if (count !== undefined) query += 'LIMIT ' + count
      if (start !== undefined) query += ' OFFSET ' + start

      const options = {
        bind: { accountIds },
        type: Sequelize.QueryTypes.SELECT,
        transaction: t
      }
      tasks.push(AccountFollowModel.sequelize.query(query, options))
    }

    const [ followers, [ { total } ] ] = await
    Promise.all(tasks)
    const urls: string[] = followers.map(f => f.url)

    return {
      data: urls,
      total: parseInt(total, 10)
    }
  }

  toFormattedJSON () {
    const follower = this.AccountFollower.toFormattedJSON()
    const following = this.AccountFollowing.toFormattedJSON()

    return {
      id: this.id,
      follower,
      following,
      state: this.state,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
