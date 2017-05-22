import { values } from 'lodash'
import * as Sequelize from 'sequelize'

import { getSort } from './utils'
import { USER_ROLES } from '../initializers'
import {
  cryptPassword,
  comparePassword,
  isUserPasswordValid,
  isUserUsernameValid,
  isUserDisplayNSFWValid
} from '../helpers'

import { addMethodsToModel } from './utils'
import {
  UserClass,
  UserInstance,
  UserAttributes,

  UserMethods
} from './user-interface'

let User: Sequelize.Model<UserInstance, UserAttributes>
let isPasswordMatch: UserMethods.IsPasswordMatch
let toFormatedJSON: UserMethods.ToFormatedJSON
let isAdmin: UserMethods.IsAdmin
let countTotal: UserMethods.CountTotal
let getByUsername: UserMethods.GetByUsername
let list: UserMethods.List
let listForApi: UserMethods.ListForApi
let loadById: UserMethods.LoadById
let loadByUsername: UserMethods.LoadByUsername
let loadByUsernameOrEmail: UserMethods.LoadByUsernameOrEmail

export default function (sequelize, DataTypes) {
  User = sequelize.define('User',
    {
      password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          passwordValid: function (value) {
            const res = isUserPasswordValid(value)
            if (res === false) throw new Error('Password not valid.')
          }
        }
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          usernameValid: function (value) {
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
          nsfwValid: function (value) {
            const res = isUserDisplayNSFWValid(value)
            if (res === false) throw new Error('Display NSFW is not valid.')
          }
        }
      },
      role: {
        type: DataTypes.ENUM(values(USER_ROLES)),
        allowNull: false
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
    toFormatedJSON,
    isAdmin
  ]
  addMethodsToModel(User, classMethods, instanceMethods)

  return User
}

function beforeCreateOrUpdate (user, options) {
  return new Promise(function (resolve, reject) {
    cryptPassword(user.password, function (err, hash) {
      if (err) return reject(err)

      user.password = hash

      return resolve()
    })
  })
}

// ------------------------------ METHODS ------------------------------

isPasswordMatch = function (password, callback) {
  return comparePassword(password, this.password, callback)
}

toFormatedJSON = function () {
  return {
    id: this.id,
    username: this.username,
    email: this.email,
    displayNSFW: this.displayNSFW,
    role: this.role,
    createdAt: this.createdAt
  }
}

isAdmin = function () {
  return this.role === USER_ROLES.ADMIN
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

countTotal = function (callback) {
  return this.count().asCallback(callback)
}

getByUsername = function (username) {
  const query = {
    where: {
      username: username
    }
  }

  return User.findOne(query)
}

list = function (callback) {
  return User.find().asCallback(callback)
}

listForApi = function (start, count, sort, callback) {
  const query = {
    offset: start,
    limit: count,
    order: [ getSort(sort) ]
  }

  return User.findAndCountAll(query).asCallback(function (err, result) {
    if (err) return callback(err)

    return callback(null, result.rows, result.count)
  })
}

loadById = function (id, callback) {
  return User.findById(id).asCallback(callback)
}

loadByUsername = function (username, callback) {
  const query = {
    where: {
      username: username
    }
  }

  return User.findOne(query).asCallback(callback)
}

loadByUsernameOrEmail = function (username, email, callback) {
  const query = {
    where: {
      $or: [ { username }, { email } ]
    }
  }

  return User.findOne(query).asCallback(callback)
}
