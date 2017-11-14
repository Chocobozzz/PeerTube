import * as Sequelize from 'sequelize'
import { hasUserRight, USER_ROLE_LABELS, UserRight } from '../../../shared'
import {
  comparePassword,
  cryptPassword,
  isUserDisplayNSFWValid,
  isUserPasswordValid,
  isUserRoleValid,
  isUserUsernameValid,
  isUserVideoQuotaValid
} from '../../helpers'
import { addMethodsToModel, getSort } from '../utils'
import { UserAttributes, UserInstance, UserMethods } from './user-interface'

let User: Sequelize.Model<UserInstance, UserAttributes>
let isPasswordMatch: UserMethods.IsPasswordMatch
let hasRight: UserMethods.HasRight
let toFormattedJSON: UserMethods.ToFormattedJSON
let countTotal: UserMethods.CountTotal
let getByUsername: UserMethods.GetByUsername
let listForApi: UserMethods.ListForApi
let loadById: UserMethods.LoadById
let loadByUsername: UserMethods.LoadByUsername
let loadByUsernameAndPopulateChannels: UserMethods.LoadByUsernameAndPopulateChannels
let loadByUsernameOrEmail: UserMethods.LoadByUsernameOrEmail
let isAbleToUploadVideo: UserMethods.IsAbleToUploadVideo

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  User = sequelize.define<UserInstance, UserAttributes>('User',
    {
      password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          passwordValid: value => {
            const res = isUserPasswordValid(value)
            if (res === false) throw new Error('Password not valid.')
          }
        }
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          usernameValid: value => {
            const res = isUserUsernameValid(value)
            if (res === false) throw new Error('Username not valid.')
          }
        }
      },
      email: {
        type: DataTypes.STRING(400),
        allowNull: false,
        validate: {
          isEmail: true
        }
      },
      displayNSFW: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        validate: {
          nsfwValid: value => {
            const res = isUserDisplayNSFWValid(value)
            if (res === false) throw new Error('Display NSFW is not valid.')
          }
        }
      },
      role: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          roleValid: value => {
            const res = isUserRoleValid(value)
            if (res === false) throw new Error('Role is not valid.')
          }
        }
      },
      videoQuota: {
        type: DataTypes.BIGINT,
        allowNull: false,
        validate: {
          videoQuotaValid: value => {
            const res = isUserVideoQuotaValid(value)
            if (res === false) throw new Error('Video quota is not valid.')
          }
        }
      }
    },
    {
      indexes: [
        {
          fields: [ 'username' ],
          unique: true
        },
        {
          fields: [ 'email' ],
          unique: true
        }
      ],
      hooks: {
        beforeCreate: beforeCreateOrUpdate,
        beforeUpdate: beforeCreateOrUpdate
      }
    }
  )

  const classMethods = [
    associate,

    countTotal,
    getByUsername,
    listForApi,
    loadById,
    loadByUsername,
    loadByUsernameAndPopulateChannels,
    loadByUsernameOrEmail
  ]
  const instanceMethods = [
    hasRight,
    isPasswordMatch,
    toFormattedJSON,
    isAbleToUploadVideo
  ]
  addMethodsToModel(User, classMethods, instanceMethods)

  return User
}

function beforeCreateOrUpdate (user: UserInstance) {
  if (user.changed('password')) {
    return cryptPassword(user.password)
      .then(hash => {
        user.password = hash
        return undefined
      })
  }
}

// ------------------------------ METHODS ------------------------------

hasRight = function (this: UserInstance, right: UserRight) {
  return hasUserRight(this.role, right)
}

isPasswordMatch = function (this: UserInstance, password: string) {
  return comparePassword(password, this.password)
}

toFormattedJSON = function (this: UserInstance) {
  const json = {
    id: this.id,
    username: this.username,
    email: this.email,
    displayNSFW: this.displayNSFW,
    role: this.role,
    roleLabel: USER_ROLE_LABELS[this.role],
    videoQuota: this.videoQuota,
    createdAt: this.createdAt,
    account: {
      id: this.Account.id,
      uuid: this.Account.uuid
    }
  }

  if (Array.isArray(this.Account.VideoChannels) === true) {
    const videoChannels = this.Account.VideoChannels
      .map(c => c.toFormattedJSON())
      .sort((v1, v2) => {
        if (v1.createdAt < v2.createdAt) return -1
        if (v1.createdAt === v2.createdAt) return 0

        return 1
      })

    json['videoChannels'] = videoChannels
  }

  return json
}

isAbleToUploadVideo = function (this: UserInstance, videoFile: Express.Multer.File) {
  if (this.videoQuota === -1) return Promise.resolve(true)

  return getOriginalVideoFileTotalFromUser(this).then(totalBytes => {
    return (videoFile.size + totalBytes) < this.videoQuota
  })
}

// ------------------------------ STATICS ------------------------------

function associate (models) {
  User.hasOne(models.Account, {
    foreignKey: 'userId',
    onDelete: 'cascade'
  })

  User.hasMany(models.OAuthToken, {
    foreignKey: 'userId',
    onDelete: 'cascade'
  })
}

countTotal = function () {
  return this.count()
}

getByUsername = function (username: string) {
  const query = {
    where: {
      username: username
    },
    include: [ { model: User['sequelize'].models.Account, required: true } ]
  }

  return User.findOne(query)
}

listForApi = function (start: number, count: number, sort: string) {
  const query = {
    offset: start,
    limit: count,
    order: [ getSort(sort) ],
    include: [ { model: User['sequelize'].models.Account, required: true } ]
  }

  return User.findAndCountAll(query).then(({ rows, count }) => {
    return {
      data: rows,
      total: count
    }
  })
}

loadById = function (id: number) {
  const options = {
    include: [ { model: User['sequelize'].models.Account, required: true } ]
  }

  return User.findById(id, options)
}

loadByUsername = function (username: string) {
  const query = {
    where: {
      username
    },
    include: [ { model: User['sequelize'].models.Account, required: true } ]
  }

  return User.findOne(query)
}

loadByUsernameAndPopulateChannels = function (username: string) {
  const query = {
    where: {
      username
    },
    include: [
      {
        model: User['sequelize'].models.Account,
        required: true,
        include: [ User['sequelize'].models.VideoChannel ]
      }
    ]
  }

  return User.findOne(query)
}

loadByUsernameOrEmail = function (username: string, email: string) {
  const query = {
    include: [ { model: User['sequelize'].models.Account, required: true } ],
    where: {
      [Sequelize.Op.or]: [ { username }, { email } ]
    }
  }

  // FIXME: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/18387
  return (User as any).findOne(query)
}

// ---------------------------------------------------------------------------

function getOriginalVideoFileTotalFromUser (user: UserInstance) {
  // Don't use sequelize because we need to use a sub query
  const query = 'SELECT SUM("size") AS "total" FROM ' +
                '(SELECT MAX("VideoFiles"."size") AS "size" FROM "VideoFiles" ' +
                'INNER JOIN "Videos" ON "VideoFiles"."videoId" = "Videos"."id" ' +
                'INNER JOIN "VideoChannels" ON "VideoChannels"."id" = "Videos"."channelId" ' +
                'INNER JOIN "Accounts" ON "VideoChannels"."accountId" = "Accounts"."id" ' +
                'INNER JOIN "Users" ON "Accounts"."userId" = "Users"."id" ' +
                'WHERE "Users"."id" = $userId GROUP BY "Videos"."id") t'

  const options = {
    bind: { userId: user.id },
    type: Sequelize.QueryTypes.SELECT
  }
  return User['sequelize'].query(query, options).then(([ { total } ]) => {
    if (total === null) return 0

    return parseInt(total, 10)
  })
}
