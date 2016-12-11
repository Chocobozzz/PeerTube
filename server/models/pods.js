'use strict'

const map = require('lodash/map')

const constants = require('../initializers/constants')

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const Pod = sequelize.define('Pod',
    {
      host: {
        type: DataTypes.STRING
      },
      publicKey: {
        type: DataTypes.STRING(5000)
      },
      score: {
        type: DataTypes.INTEGER,
        defaultValue: constants.FRIEND_SCORE.BASE
      }
      // Check createdAt
    },
    {
      classMethods: {
        associate,

        countAll,
        incrementScores,
        list,
        listAllIds,
        listBadPods,
        load,
        loadByHost,
        removeAll
      },
      instanceMethods: {
        toFormatedJSON
      }
    }
  )

  return Pod
}

// TODO: max score -> constants.FRIENDS_SCORE.MAX
// TODO: validation
// PodSchema.path('host').validate(validator.isURL)
// PodSchema.path('publicKey').required(true)
// PodSchema.path('score').validate(function (value) { return !isNaN(value) })

// ------------------------------ METHODS ------------------------------

function toFormatedJSON () {
  const json = {
    id: this.id,
    host: this.host,
    score: this.score,
    createdAt: this.createdAt
  }

  return json
}

// ------------------------------ Statics ------------------------------

function associate (models) {
  this.belongsToMany(models.Request, {
    foreignKey: 'podId',
    through: models.RequestToPod,
    onDelete: 'CASCADE'
  })
}

function countAll (callback) {
  return this.count().asCallback(callback)
}

function incrementScores (ids, value, callback) {
  if (!callback) callback = function () {}

  const update = {
    score: this.sequelize.literal('score +' + value)
  }

  const query = {
    where: {
      id: {
        $in: ids
      }
    }
  }

  return this.update(update, query).asCallback(callback)
}

function list (callback) {
  return this.findAll().asCallback(callback)
}

function listAllIds (callback) {
  const query = {
    attributes: [ 'id' ]
  }

  return this.findAll(query).asCallback(function (err, pods) {
    if (err) return callback(err)

    return callback(null, map(pods, 'id'))
  })
}

function listBadPods (callback) {
  const query = {
    where: {
      score: { $lte: 0 }
    }
  }

  return this.findAll(query).asCallback(callback)
}

function load (id, callback) {
  return this.findById(id).asCallback(callback)
}

function loadByHost (host, callback) {
  const query = {
    where: {
      host: host
    }
  }

  return this.findOne(query).asCallback(callback)
}

function removeAll (callback) {
  return this.destroy().asCallback(callback)
}
