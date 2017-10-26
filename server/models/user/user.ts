import { values } from 'lodash'
import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { getSort } from '../utils'
import { USER_ROLES } from '../../initializers'
import {
  cryptPassword,
  comparePassword,
  isUserPasswordValid,
  isUserUsernameValid,
  isUserDisplayNSFWValid,
  isUserVideoQuotaValid
} from '../../helpers'

import { addMethodsToModel } from '../utils'
import {
  UserInstance,
  UserAttributes,

  UserMethods
} from './user-interface'

let User: Sequelize.Model<UserInstance, UserAttributes>
let isPasswordMatch: UserMethods.IsPasswordMatch
let toFormattedJSON: UserMethods.ToFormattedJSON
let isAdmin: UserMethods.IsAdmin
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
        type: DataTypes.ENUM(values(USER_ROLES)),
        allowNull: false
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
    isPasswordMatch,
    toFormattedJSON,
    isAdmin,
    isAbleToUploadVideo
  ]
  addMethodsToModel(User, classMethods, instanceMethods)

  return User
}

function beforeCreateOrUpdate (user: UserInstance) {
  return cryptPassword(user.password).then(hash => {
    user.password = hash
    return undefined
  })
}

// ------------------------------ METHODS ------------------------------

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
    videoQuota: this.videoQuota,
    createdAt: this.createdAt,
    author: {
      id: this.Author.id,
      uuid: this.Author.uuid
    }
  }

  if (Array.isArray(this.Author.VideoChannels) === true) {
    const videoChannels = this.Author.VideoChannels
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

isAdmin = function (this: UserInstance) {
  return this.role === USER_ROLES.ADMIN
}

isAbleToUploadVideo = function (this: UserInstance, videoFile: Express.Multer.File) {
  if (this.videoQuota === -1) return Promise.resolve(true)

  return getOriginalVideoFileTotalFromUser(this).then(totalBytes => {
    return (videoFile.size + totalBytes) < this.videoQuota
  })
}

// ------------------------------ STATICS ------------------------------

function associate (models) {
  User.hasOne(models.Author, {
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
    include: [ { model: User['sequelize'].models.Author, required: true } ]
  }

  return User.findOne(query)
}

listForApi = function (start: number, count: number, sort: string) {
  const query = {
    offset: start,
    limit: count,
    order: [ getSort(sort) ],
    include: [ { model: User['sequelize'].models.Author, required: true } ]
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
    include: [ { model: User['sequelize'].models.Author, required: true } ]
  }

  return User.findById(id, options)
}

loadByUsername = function (username: string) {
  const query = {
    where: {
      username
    },
    include: [ { model: User['sequelize'].models.Author, required: true } ]
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
        model: User['sequelize'].models.Author,
        required: true,
        include: [ User['sequelize'].models.VideoChannel ]
      }
    ]
  }

  return User.findOne(query)
}

loadByUsernameOrEmail = function (username: string, email: string) {
  const query = {
    include: [ { model: User['sequelize'].models.Author, required: true } ],
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
                'INNER JOIN "Authors" ON "VideoChannels"."authorId" = "Authors"."id" ' +
                'INNER JOIN "Users" ON "Authors"."userId" = "Users"."id" ' +
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
