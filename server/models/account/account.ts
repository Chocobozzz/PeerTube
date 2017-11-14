import * as Sequelize from 'sequelize'

import {
  isUserUsernameValid,
  isAccountPublicKeyValid,
  isAccountUrlValid,
  isAccountPrivateKeyValid,
  isAccountFollowersCountValid,
  isAccountFollowingCountValid,
  isAccountInboxValid,
  isAccountOutboxValid,
  isAccountSharedInboxValid,
  isAccountFollowersValid,
  isAccountFollowingValid,
  activityPubContextify
} from '../../helpers'

import { addMethodsToModel, getSort } from '../utils'
import {
  AccountInstance,
  AccountAttributes,

  AccountMethods
} from './account-interface'
import { sendDeleteAccount } from '../../lib/activitypub/send-request'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants'

let Account: Sequelize.Model<AccountInstance, AccountAttributes>
let loadAccountByPodAndUUID: AccountMethods.LoadAccountByPodAndUUID
let load: AccountMethods.Load
let loadApplication: AccountMethods.LoadApplication
let loadByUUID: AccountMethods.LoadByUUID
let loadByUrl: AccountMethods.LoadByUrl
let loadLocalByName: AccountMethods.LoadLocalByName
let loadByNameAndHost: AccountMethods.LoadByNameAndHost
let listOwned: AccountMethods.ListOwned
let listAcceptedFollowerUrlsForApi: AccountMethods.ListAcceptedFollowerUrlsForApi
let listAcceptedFollowingUrlsForApi: AccountMethods.ListAcceptedFollowingUrlsForApi
let listFollowingForApi: AccountMethods.ListFollowingForApi
let listFollowersForApi: AccountMethods.ListFollowersForApi
let isOwned: AccountMethods.IsOwned
let toActivityPubObject: AccountMethods.ToActivityPubObject
let toFormattedJSON: AccountMethods.ToFormattedJSON
let getFollowerSharedInboxUrls: AccountMethods.GetFollowerSharedInboxUrls
let getFollowingUrl: AccountMethods.GetFollowingUrl
let getFollowersUrl: AccountMethods.GetFollowersUrl
let getPublicKeyUrl: AccountMethods.GetPublicKeyUrl

export default function defineAccount (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  Account = sequelize.define<AccountInstance, AccountAttributes>('Account',
    {
      uuid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        validate: {
          isUUID: 4
        }
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          nameValid: value => {
            const res = isUserUsernameValid(value)
            if (res === false) throw new Error('Name is not valid.')
          }
        }
      },
      url: {
        type: DataTypes.STRING(CONSTRAINTS_FIELDS.ACCOUNTS.URL.max),
        allowNull: false,
        validate: {
          urlValid: value => {
            const res = isAccountUrlValid(value)
            if (res === false) throw new Error('URL is not valid.')
          }
        }
      },
      publicKey: {
        type: DataTypes.STRING(CONSTRAINTS_FIELDS.ACCOUNTS.PUBLIC_KEY.max),
        allowNull: false,
        validate: {
          publicKeyValid: value => {
            const res = isAccountPublicKeyValid(value)
            if (res === false) throw new Error('Public key is not valid.')
          }
        }
      },
      privateKey: {
        type: DataTypes.STRING(CONSTRAINTS_FIELDS.ACCOUNTS.PRIVATE_KEY.max),
        allowNull: true,
        validate: {
          privateKeyValid: value => {
            const res = isAccountPrivateKeyValid(value)
            if (res === false) throw new Error('Private key is not valid.')
          }
        }
      },
      followersCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          followersCountValid: value => {
            const res = isAccountFollowersCountValid(value)
            if (res === false) throw new Error('Followers count is not valid.')
          }
        }
      },
      followingCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          followingCountValid: value => {
            const res = isAccountFollowingCountValid(value)
            if (res === false) throw new Error('Following count is not valid.')
          }
        }
      },
      inboxUrl: {
        type: DataTypes.STRING(CONSTRAINTS_FIELDS.ACCOUNTS.URL.max),
        allowNull: false,
        validate: {
          inboxUrlValid: value => {
            const res = isAccountInboxValid(value)
            if (res === false) throw new Error('Inbox URL is not valid.')
          }
        }
      },
      outboxUrl: {
        type: DataTypes.STRING(CONSTRAINTS_FIELDS.ACCOUNTS.URL.max),
        allowNull: false,
        validate: {
          outboxUrlValid: value => {
            const res = isAccountOutboxValid(value)
            if (res === false) throw new Error('Outbox URL is not valid.')
          }
        }
      },
      sharedInboxUrl: {
        type: DataTypes.STRING(CONSTRAINTS_FIELDS.ACCOUNTS.URL.max),
        allowNull: false,
        validate: {
          sharedInboxUrlValid: value => {
            const res = isAccountSharedInboxValid(value)
            if (res === false) throw new Error('Shared inbox URL is not valid.')
          }
        }
      },
      followersUrl: {
        type: DataTypes.STRING(CONSTRAINTS_FIELDS.ACCOUNTS.URL.max),
        allowNull: false,
        validate: {
          followersUrlValid: value => {
            const res = isAccountFollowersValid(value)
            if (res === false) throw new Error('Followers URL is not valid.')
          }
        }
      },
      followingUrl: {
        type: DataTypes.STRING(CONSTRAINTS_FIELDS.ACCOUNTS.URL.max),
        allowNull: false,
        validate: {
          followingUrlValid: value => {
            const res = isAccountFollowingValid(value)
            if (res === false) throw new Error('Following URL is not valid.')
          }
        }
      }
    },
    {
      indexes: [
        {
          fields: [ 'name' ]
        },
        {
          fields: [ 'podId' ]
        },
        {
          fields: [ 'userId' ],
          unique: true
        },
        {
          fields: [ 'applicationId' ],
          unique: true
        },
        {
          fields: [ 'name', 'podId' ],
          unique: true
        }
      ],
      hooks: { afterDestroy }
    }
  )

  const classMethods = [
    associate,
    loadAccountByPodAndUUID,
    loadApplication,
    load,
    loadByUUID,
    loadByUrl,
    loadLocalByName,
    loadByNameAndHost,
    listOwned,
    listAcceptedFollowerUrlsForApi,
    listAcceptedFollowingUrlsForApi,
    listFollowingForApi,
    listFollowersForApi
  ]
  const instanceMethods = [
    isOwned,
    toActivityPubObject,
    toFormattedJSON,
    getFollowerSharedInboxUrls,
    getFollowingUrl,
    getFollowersUrl,
    getPublicKeyUrl
  ]
  addMethodsToModel(Account, classMethods, instanceMethods)

  return Account
}

// ---------------------------------------------------------------------------

function associate (models) {
  Account.belongsTo(models.Pod, {
    foreignKey: {
      name: 'podId',
      allowNull: true
    },
    onDelete: 'cascade'
  })

  Account.belongsTo(models.User, {
    foreignKey: {
      name: 'userId',
      allowNull: true
    },
    onDelete: 'cascade'
  })

  Account.belongsTo(models.Application, {
    foreignKey: {
      name: 'applicationId',
      allowNull: true
    },
    onDelete: 'cascade'
  })

  Account.hasMany(models.VideoChannel, {
    foreignKey: {
      name: 'accountId',
      allowNull: false
    },
    onDelete: 'cascade',
    hooks: true
  })

  Account.hasMany(models.AccountFollow, {
    foreignKey: {
      name: 'accountId',
      allowNull: false
    },
    as: 'following',
    onDelete: 'cascade'
  })

  Account.hasMany(models.AccountFollow, {
    foreignKey: {
      name: 'targetAccountId',
      allowNull: false
    },
    as: 'followers',
    onDelete: 'cascade'
  })
}

function afterDestroy (account: AccountInstance) {
  if (account.isOwned()) {
    return sendDeleteAccount(account, undefined)
  }

  return undefined
}

toFormattedJSON = function (this: AccountInstance) {
  const json = {
    id: this.id,
    host: this.Pod.host,
    name: this.name
  }

  return json
}

toActivityPubObject = function (this: AccountInstance) {
  const type = this.podId ? 'Application' as 'Application' : 'Person' as 'Person'

  const json = {
    type,
    id: this.url,
    following: this.getFollowingUrl(),
    followers: this.getFollowersUrl(),
    inbox: this.inboxUrl,
    outbox: this.outboxUrl,
    preferredUsername: this.name,
    url: this.url,
    name: this.name,
    endpoints: {
      sharedInbox: this.sharedInboxUrl
    },
    uuid: this.uuid,
    publicKey: {
      id: this.getPublicKeyUrl(),
      owner: this.url,
      publicKeyPem: this.publicKey
    }
  }

  return activityPubContextify(json)
}

isOwned = function (this: AccountInstance) {
  return this.podId === null
}

getFollowerSharedInboxUrls = function (this: AccountInstance) {
  const query: Sequelize.FindOptions<AccountAttributes> = {
    attributes: [ 'sharedInboxUrl' ],
    include: [
      {
        model: Account['sequelize'].models.AccountFollow,
        required: true,
        as: 'followers',
        where: {
          targetAccountId: this.id
        }
      }
    ]
  }

  return Account.findAll(query)
    .then(accounts => accounts.map(a => a.sharedInboxUrl))
}

getFollowingUrl = function (this: AccountInstance) {
  return this.url + '/followers'
}

getFollowersUrl = function (this: AccountInstance) {
  return this.url + '/followers'
}

getPublicKeyUrl = function (this: AccountInstance) {
  return this.url + '#main-key'
}

// ------------------------------ STATICS ------------------------------

listOwned = function () {
  const query: Sequelize.FindOptions<AccountAttributes> = {
    where: {
      podId: null
    }
  }

  return Account.findAll(query)
}

listAcceptedFollowerUrlsForApi = function (id: number, start: number, count?: number) {
  return createListAcceptedFollowForApiQuery('followers', id, start, count)
}

listAcceptedFollowingUrlsForApi = function (id: number, start: number, count?: number) {
  return createListAcceptedFollowForApiQuery('following', id, start, count)
}

listFollowingForApi = function (id: number, start: number, count: number, sort: string) {
  const query = {
    distinct: true,
    offset: start,
    limit: count,
    order: [ getSort(sort) ],
    include: [
      {
        model: Account['sequelize'].models.AccountFollow,
        required: true,
        as: 'following',
        include: [
          {
            model: Account['sequelize'].models.Account,
            as: 'accountFollowing',
            required: true,
            include: [ Account['sequelize'].models.Pod ]
          }
        ]
      }
    ]
  }

  return Account.findAndCountAll(query).then(({ rows, count }) => {
    return {
      data: rows,
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
        model: Account['sequelize'].models.AccountFollow,
        required: true,
        as: 'followers',
        include: [
          {
            model: Account['sequelize'].models.Account,
            as: 'accountFollowers',
            required: true,
            include: [ Account['sequelize'].models.Pod ]
          }
        ]
      }
    ]
  }

  return Account.findAndCountAll(query).then(({ rows, count }) => {
    return {
      data: rows,
      total: count
    }
  })
}

loadApplication = function () {
  return Account.findOne({
    include: [
      {
        model: Account['sequelize'].models.Application,
        required: true
      }
    ]
  })
}

load = function (id: number) {
  return Account.findById(id)
}

loadByUUID = function (uuid: string) {
  const query: Sequelize.FindOptions<AccountAttributes> = {
    where: {
      uuid
    }
  }

  return Account.findOne(query)
}

loadLocalByName = function (name: string) {
  const query: Sequelize.FindOptions<AccountAttributes> = {
    where: {
      name,
      [Sequelize.Op.or]: [
        {
          userId: {
            [Sequelize.Op.ne]: null
          }
        },
        {
          applicationId: {
            [Sequelize.Op.ne]: null
          }
        }
      ]
    }
  }

  return Account.findOne(query)
}

loadByNameAndHost = function (name: string, host: string) {
  const query: Sequelize.FindOptions<AccountAttributes> = {
    where: {
      name
    },
    include: [
      {
        model: Account['sequelize'].models.Pod,
        required: true,
        where: {
          host
        }
      }
    ]
  }

  return Account.findOne(query)
}

loadByUrl = function (url: string, transaction?: Sequelize.Transaction) {
  const query: Sequelize.FindOptions<AccountAttributes> = {
    where: {
      url
    },
    transaction
  }

  return Account.findOne(query)
}

loadAccountByPodAndUUID = function (uuid: string, podId: number, transaction: Sequelize.Transaction) {
  const query: Sequelize.FindOptions<AccountAttributes> = {
    where: {
      podId,
      uuid
    },
    transaction
  }

  return Account.find(query)
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
    tasks.push(Account['sequelize'].query(query, options))
  }

  const [ followers, [ { total } ]] = await Promise.all(tasks)
  const urls: string[] = followers.map(f => f.url)

  return {
    data: urls,
    total: parseInt(total, 10)
  }
}
