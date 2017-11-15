import { values } from 'lodash'
import * as Sequelize from 'sequelize'

import { addMethodsToModel, getSort } from '../utils'
import { AccountFollowAttributes, AccountFollowInstance, AccountFollowMethods } from './account-follow-interface'
import { FOLLOW_STATES } from '../../initializers/constants'

let AccountFollow: Sequelize.Model<AccountFollowInstance, AccountFollowAttributes>
let loadByAccountAndTarget: AccountFollowMethods.LoadByAccountAndTarget
let listFollowingForApi: AccountFollowMethods.ListFollowingForApi
let listFollowersForApi: AccountFollowMethods.ListFollowersForApi
let listAcceptedFollowerUrlsForApi: AccountFollowMethods.ListAcceptedFollowerUrlsForApi
let listAcceptedFollowingUrlsForApi: AccountFollowMethods.ListAcceptedFollowingUrlsForApi

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  AccountFollow = sequelize.define<AccountFollowInstance, AccountFollowAttributes>('AccountFollow',
    {
      state: {
        type: DataTypes.ENUM(values(FOLLOW_STATES)),
        allowNull: false
      }
    },
    {
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
    }
  )

  const classMethods = [
    associate,
    loadByAccountAndTarget,
    listFollowingForApi,
    listFollowersForApi,
    listAcceptedFollowerUrlsForApi,
    listAcceptedFollowingUrlsForApi
  ]
  addMethodsToModel(AccountFollow, classMethods)

  return AccountFollow
}

// ------------------------------ STATICS ------------------------------

function associate (models) {
  AccountFollow.belongsTo(models.Account, {
    foreignKey: {
      name: 'accountId',
      allowNull: false
    },
    as: 'AccountFollower',
    onDelete: 'CASCADE'
  })

  AccountFollow.belongsTo(models.Account, {
    foreignKey: {
      name: 'targetAccountId',
      allowNull: false
    },
    as: 'AccountFollowing',
    onDelete: 'CASCADE'
  })
}

loadByAccountAndTarget = function (accountId: number, targetAccountId: number) {
  const query = {
    where: {
      accountId,
      targetAccountId
    }
  }

  return AccountFollow.findOne(query)
}

listFollowingForApi = function (id: number, start: number, count: number, sort: string) {
  const query = {
    distinct: true,
    offset: start,
    limit: count,
    order: [ getSort(sort) ],
    include: [
      {
        model: AccountFollow[ 'sequelize' ].models.Account,
        required: true,
        as: 'AccountFollower',
        where: {
          id
        }
      },
      {
        model: AccountFollow['sequelize'].models.Account,
        as: 'AccountFollowing',
        required: true,
        include: [ AccountFollow['sequelize'].models.Pod ]
      }
    ]
  }

  return AccountFollow.findAndCountAll(query).then(({ rows, count }) => {
    return {
      data: rows.map(r => r.AccountFollowing),
      total: count
    }
  })
}

listFollowersForApi = function (id: number, start: number, count: number, sort: string) {
  const query = {
    distinct: true,
    offset: start,
    limit: count,
    order: [ getSort(sort) ],
    include: [
      {
        model: AccountFollow[ 'sequelize' ].models.Account,
        required: true,
        as: 'AccountFollower',
        include: [ AccountFollow['sequelize'].models.Pod ]
      },
      {
        model: AccountFollow['sequelize'].models.Account,
        as: 'AccountFollowing',
        required: true,
        where: {
          id
        }
      }
    ]
  }

  return AccountFollow.findAndCountAll(query).then(({ rows, count }) => {
    return {
      data: rows.map(r => r.AccountFollower),
      total: count
    }
  })
}

listAcceptedFollowerUrlsForApi = function (id: number, start: number, count?: number) {
  return createListAcceptedFollowForApiQuery('followers', id, start, count)
}

listAcceptedFollowingUrlsForApi = function (id: number, start: number, count?: number) {
  return createListAcceptedFollowForApiQuery('following', id, start, count)
}

// ------------------------------ UTILS ------------------------------

async function createListAcceptedFollowForApiQuery (type: 'followers' | 'following', id: number, start: number, count?: number) {
  let firstJoin: string
  let secondJoin: string

  if (type === 'followers') {
    firstJoin = 'targetAccountId'
    secondJoin = 'accountId'
  } else {
    firstJoin = 'accountId'
    secondJoin = 'targetAccountId'
  }

  const selections = [ '"Followers"."url" AS "url"', 'COUNT(*) AS "total"' ]
  const tasks: Promise<any>[] = []

  for (const selection of selections) {
    let query = 'SELECT ' + selection + ' FROM "Account" ' +
      'INNER JOIN "AccountFollow" ON "AccountFollow"."' + firstJoin + '" = "Account"."id" ' +
      'INNER JOIN "Account" AS "Follows" ON "Followers"."id" = "Follows"."' + secondJoin + '" ' +
      'WHERE "Account"."id" = $id AND "AccountFollow"."state" = \'accepted\' ' +
      'LIMIT ' + start

    if (count !== undefined) query += ', ' + count

    const options = {
      bind: { id },
      type: Sequelize.QueryTypes.SELECT
    }
    tasks.push(AccountFollow['sequelize'].query(query, options))
  }

  const [ followers, [ { total } ]] = await Promise.all(tasks)
  const urls: string[] = followers.map(f => f.url)

  return {
    data: urls,
    total: parseInt(total, 10)
  }
}
