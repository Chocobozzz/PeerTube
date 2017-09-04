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
let list: UserMethods.List
let listForApi: UserMethods.ListForApi
let loadById: UserMethods.LoadById
let loadByUsername: UserMethods.LoadByUsername
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
    list,
    listForApi,
    loadById,
    loadByUsername,
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
  return {
    id: this.id,
    username: this.username,
    email: this.email,
    displayNSFW: this.displayNSFW,
    role: this.role,
    videoQuota: this.videoQuota,
    createdAt: this.createdAt
  }
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
    }
  }

  return User.findOne(query)
}

list = function () {
  return User.findAll()
}

listForApi = function (start: number, count: number, sort: string) {
  const query = {
    offset: start,
    limit: count,
    order: [ getSort(sort) ]
  }

  return User.findAndCountAll(query).then(({ rows, count }) => {
    return {
      data: rows,
      total: count
    }
  })
}

loadById = function (id: number) {
  return User.findById(id)
}

loadByUsername = function (username: string) {
  const query = {
    where: {
      username
    }
  }

  return User.findOne(query)
}

loadByUsernameOrEmail = function (username: string, email: string) {
  const query = {
    where: {
      $or: [ { username }, { email } ]
    }
  }

  // FIXME: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/18387
  return (User as any).findOne(query)
}

// ---------------------------------------------------------------------------

function getOriginalVideoFileTotalFromUser (user: UserInstance) {
  const query = {
    attributes: [
      Sequelize.fn('COUNT', Sequelize.col('VideoFile.size'), 'totalVideoBytes')
    ],
    where: {
      id: user.id
    },
    include: [
      {
        model: User['sequelize'].models.Author,
        include: [
          {
            model: User['sequelize'].models.Video,
            include: [
              {
                model: User['sequelize'].models.VideoFile
              }
            ]
          }
        ]
      }
    ]
  }

  // FIXME: cast to any because of bad typing...
  return User.findAll(query).then((res: any) => {
    return res.totalVideoBytes
  })
}
