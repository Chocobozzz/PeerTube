'use strict'

const map = require('lodash/map')

const constants = require('../initializers/constants')
const customPodsValidators = require('../helpers/custom-validators').pods

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const Pod = sequelize.define('Pod',
    {
      host: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isHost: function (value) {
            const res = customPodsValidators.isHostValid(value)
            if (res === false) throw new Error('Host not valid.')
          }
        }
      },
      publicKey: {
        type: DataTypes.STRING(5000),
        allowNull: false
      },
      score: {
        type: DataTypes.INTEGER,
        defaultValue: constants.FRIEND_SCORE.BASE,
        allowNull: false,
        validate: {
          isInt: true,
          max: constants.FRIEND_SCORE.MAX
        }
      }
    },
    {
      indexes: [
        {
          fields: [ 'host' ]
        },
        {
          fields: [ 'score' ]
        }
      ],
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
    onDelete: 'cascade'
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

  const options = {
    where: {
      id: {
        $in: ids
      }
    },
    // In this case score is a literal and not an integer so we do not validate it
    validate: false
  }

  return this.update(update, options).asCallback(callback)
}

function list (callback) {
  return this.findAll().asCallback(callback)
}

function listAllIds (transaction, callback) {
  if (!callback) {
    callback = transaction
    transaction = null
  }

  const query = {
    attributes: [ 'id' ]
  }

  if (transaction) query.transaction = transaction

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
