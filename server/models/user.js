const modelUtils = require('./utils')
const peertubeCrypto = require('../helpers/peertube-crypto')

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const User = sequelize.define('User',
    {
      password: {
        type: DataTypes.STRING
      },
      username: {
        type: DataTypes.STRING
      },
      role: {
        type: DataTypes.STRING
      }
    },
    {
      classMethods: {
        associate,

        countTotal,
        getByUsername,
        list,
        listForApi,
        loadById,
        loadByUsername
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

// TODO: Validation
// UserSchema.path('password').required(customUsersValidators.isUserPasswordValid)
// UserSchema.path('username').required(customUsersValidators.isUserUsernameValid)
// UserSchema.path('role').validate(customUsersValidators.isUserRoleValid)

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
    role: this.role,
    createdAt: this.createdAt
  }
}
// ------------------------------ STATICS ------------------------------

function associate (models) {
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
