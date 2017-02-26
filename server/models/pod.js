'use strict'

const each = require('async/each')
const map = require('lodash/map')
const waterfall = require('async/waterfall')

const constants = require('../initializers/constants')
const logger = require('../helpers/logger')
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
      },
      email: {
        type: DataTypes.STRING(400),
        allowNull: false,
        validate: {
          isEmail: true
        }
      }
    },
    {
      indexes: [
        {
          fields: [ 'host' ],
          unique: true
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
        listRandomPodIdsWithRequest,
        listBadPods,
        load,
        loadByHost,
        updatePodsScore,
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
    email: this.email,
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

function listRandomPodIdsWithRequest (limit, tableWithPods, tableWithPodsJoins, callback) {
  if (!callback) {
    callback = tableWithPodsJoins
    tableWithPodsJoins = ''
  }

  const self = this

  self.count().asCallback(function (err, count) {
    if (err) return callback(err)

    // Optimization...
    if (count === 0) return callback(null, [])

    let start = Math.floor(Math.random() * count) - limit
    if (start < 0) start = 0

    const query = {
      attributes: [ 'id' ],
      order: [
        [ 'id', 'ASC' ]
      ],
      offset: start,
      limit: limit,
      where: {
        id: {
          $in: [
            this.sequelize.literal(`SELECT DISTINCT "${tableWithPods}"."podId" FROM "${tableWithPods}" ${tableWithPodsJoins}`)
          ]
        }
      }
    }

    return this.findAll(query).asCallback(function (err, pods) {
      if (err) return callback(err)

      return callback(null, map(pods, 'id'))
    })
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

function updatePodsScore (goodPods, badPods) {
  const self = this

  logger.info('Updating %d good pods and %d bad pods scores.', goodPods.length, badPods.length)

  if (goodPods.length !== 0) {
    this.incrementScores(goodPods, constants.PODS_SCORE.BONUS, function (err) {
      if (err) logger.error('Cannot increment scores of good pods.', { error: err })
    })
  }

  if (badPods.length !== 0) {
    this.incrementScores(badPods, constants.PODS_SCORE.MALUS, function (err) {
      if (err) logger.error('Cannot decrement scores of bad pods.', { error: err })
      removeBadPods.call(self)
    })
  }
}

// ---------------------------------------------------------------------------

// Remove pods with a score of 0 (too many requests where they were unreachable)
function removeBadPods () {
  const self = this

  waterfall([
    function findBadPods (callback) {
      self.sequelize.models.Pod.listBadPods(function (err, pods) {
        if (err) {
          logger.error('Cannot find bad pods.', { error: err })
          return callback(err)
        }

        return callback(null, pods)
      })
    },

    function removeTheseBadPods (pods, callback) {
      each(pods, function (pod, callbackEach) {
        pod.destroy().asCallback(callbackEach)
      }, function (err) {
        return callback(err, pods.length)
      })
    }
  ], function (err, numberOfPodsRemoved) {
    if (err) {
      logger.error('Cannot remove bad pods.', { error: err })
    } else if (numberOfPodsRemoved) {
      logger.info('Removed %d pods.', numberOfPodsRemoved)
    } else {
      logger.info('No need to remove bad pods.')
    }
  })
}
