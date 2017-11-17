import * as Sequelize from 'sequelize'

import {
  activityPubContextify,
  isAccountFollowersCountValid,
  isAccountFollowersValid,
  isAccountFollowingCountValid,
  isAccountFollowingValid,
  isAccountInboxValid,
  isAccountOutboxValid,
  isAccountPrivateKeyValid,
  isAccountPublicKeyValid,
  isAccountSharedInboxValid,
  isAccountUrlValid,
  isUserUsernameValid
} from '../../helpers'
import { CONFIG, CONSTRAINTS_FIELDS } from '../../initializers/constants'
import { sendDeleteAccount } from '../../lib/activitypub/send-request'

import { addMethodsToModel } from '../utils'
import { AccountAttributes, AccountInstance, AccountMethods } from './account-interface'

let Account: Sequelize.Model<AccountInstance, AccountAttributes>
let loadAccountByServerAndUUID: AccountMethods.LoadAccountByServerAndUUID
let load: AccountMethods.Load
let loadApplication: AccountMethods.LoadApplication
let loadByUUID: AccountMethods.LoadByUUID
let loadByUrl: AccountMethods.LoadByUrl
let loadLocalByName: AccountMethods.LoadLocalByName
let loadByNameAndHost: AccountMethods.LoadByNameAndHost
let listOwned: AccountMethods.ListOwned
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
        allowNull: true,
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
          fields: [ 'serverId' ]
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
          fields: [ 'name', 'serverId', 'applicationId' ],
          unique: true
        }
      ],
      hooks: { afterDestroy }
    }
  )

  const classMethods = [
    associate,
    loadAccountByServerAndUUID,
    loadApplication,
    load,
    loadByUUID,
    loadByUrl,
    loadLocalByName,
    loadByNameAndHost,
    listOwned
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
  Account.belongsTo(models.Server, {
    foreignKey: {
      name: 'serverId',
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
  let host = CONFIG.WEBSERVER.HOST
  let score: number

  if (this.Server) {
    host = this.Server.host
    score = this.Server.score as number
  }

  const json = {
    id: this.id,
    host,
    score,
    name: this.name,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  }

  return json
}

toActivityPubObject = function (this: AccountInstance) {
  const type = this.serverId ? 'Application' as 'Application' : 'Person' as 'Person'

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
  return this.serverId === null
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
  return this.url + '/following'
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
      serverId: null
    }
  }

  return Account.findAll(query)
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
        model: Account['sequelize'].models.Server,
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

loadAccountByServerAndUUID = function (uuid: string, serverId: number, transaction: Sequelize.Transaction) {
  const query: Sequelize.FindOptions<AccountAttributes> = {
    where: {
      serverId,
      uuid
    },
    transaction
  }

  return Account.find(query)
}
