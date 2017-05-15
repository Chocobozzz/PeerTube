import { values } from 'lodash'

import { getSort } from './utils'
import { USER_ROLES } from '../initializers'
import {
  cryptPassword,
  comparePassword,
  isUserPasswordValid,
  isUserUsernameValid,
  isUserDisplayNSFWValid
} from '../helpers'

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const User = sequelize.define('User',
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
        toFormatedJSON,
        isAdmin
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
  cryptPassword(user.password, function (err, hash) {
    if (err) return next(err)

    user.password = hash

    return next()
  })
}

// ------------------------------ METHODS ------------------------------

function isPasswordMatch (password, callback) {
  return comparePassword(password, this.password, callback)
}

function toFormatedJSON () {
  return {
    id: this.id,
    username: this.username,
    email: this.email,
    displayNSFW: this.displayNSFW,
    role: this.role,
    createdAt: this.createdAt
  }
}

function isAdmin () {
  return this.role === USER_ROLES.ADMIN
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
    order: [ getSort(sort) ]
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
