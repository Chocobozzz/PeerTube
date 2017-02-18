'use strict'

const values = require('lodash/values')

const modelUtils = require('./utils')
const constants = require('../initializers/constants')
const peertubeCrypto = require('../helpers/peertube-crypto')
const customUsersValidators = require('../helpers/custom-validators').users

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const User = sequelize.define('User',
    {
      password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          passwordValid: function (value) {
            const res = customUsersValidators.isUserPasswordValid(value)
            if (res === false) throw new Error('Password not valid.')
          }
        }
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          usernameValid: function (value) {
            const res = customUsersValidators.isUserUsernameValid(value)
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
      role: {
        type: DataTypes.ENUM(values(constants.USER_ROLES)),
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
      classMethods: {
        associate,

        countTotal,
        getByUsername,
        list,
        listForApi,
        loadById,
        loadByUsername,
        loadByUsernameOrEmail
      },
      instanceMethods: {
        isPasswordMatch,
        toFormatedJSON
      },
      hooks: {
        beforeCreate: beforeCreateOrUpdate,
        beforeUpdate: beforeCreateOrUpdate
      }
    }
  )

  return User
}

function beforeCreateOrUpdate (user, options, next) {
  peertubeCrypto.cryptPassword(user.password, function (err, hash) {
    if (err) return next(err)

    user.password = hash

    return next()
  })
}

// ------------------------------ METHODS ------------------------------

function isPasswordMatch (password, callback) {
  return peertubeCrypto.comparePassword(password, this.password, callback)
}

function toFormatedJSON () {
  return {
    id: this.id,
    username: this.username,
    email: this.email,
    role: this.role,
    createdAt: this.createdAt
  }
}
// ------------------------------ STATICS ------------------------------

function associate (models) {
  this.hasOne(models.Author, {
    foreignKey: 'userId',
    onDelete: 'cascade'
  })

  this.hasMany(models.OAuthToken, {
    foreignKey: 'userId',
    onDelete: 'cascade'
  })
}

function countTotal (callback) {
  return this.count().asCallback(callback)
}

function getByUsername (username) {
  const query = {
    where: {
      username: username
    }
  }

  return this.findOne(query)
}

function list (callback) {
  return this.find().asCallback(callback)
}

function listForApi (start, count, sort, callback) {
  const query = {
    offset: start,
    limit: count,
    order: [ modelUtils.getSort(sort) ]
  }

  return this.findAndCountAll(query).asCallback(function (err, result) {
    if (err) return callback(err)

    return callback(null, result.rows, result.count)
  })
}

function loadById (id, callback) {
  return this.findById(id).asCallback(callback)
}

function loadByUsername (username, callback) {
  const query = {
    where: {
      username: username
    }
  }

  return this.findOne(query).asCallback(callback)
}

function loadByUsernameOrEmail (username, email, callback) {
  const query = {
    where: {
      $or: [ { username }, { email } ]
    }
  }

  return this.findOne(query).asCallback(callback)
}
