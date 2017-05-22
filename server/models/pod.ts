import { each, waterfall } from 'async'
import { map } from 'lodash'
import * as Sequelize from 'sequelize'

import { FRIEND_SCORE, PODS_SCORE } from '../initializers'
import { logger, isHostValid } from '../helpers'

import { addMethodsToModel } from './utils'
import {
  PodClass,
  PodInstance,
  PodAttributes,

  PodMethods
} from './pod-interface'

let Pod: Sequelize.Model<PodInstance, PodAttributes>
let toFormatedJSON: PodMethods.ToFormatedJSON
let countAll: PodMethods.CountAll
let incrementScores: PodMethods.IncrementScores
let list: PodMethods.List
let listAllIds: PodMethods.ListAllIds
let listRandomPodIdsWithRequest: PodMethods.ListRandomPodIdsWithRequest
let listBadPods: PodMethods.ListBadPods
let load: PodMethods.Load
let loadByHost: PodMethods.LoadByHost
let removeAll: PodMethods.RemoveAll
let updatePodsScore: PodMethods.UpdatePodsScore

export default function (sequelize, DataTypes) {
  Pod = sequelize.define('Pod',
    {
      host: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isHost: function (value) {
            const res = isHostValid(value)
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
        defaultValue: FRIEND_SCORE.BASE,
        allowNull: false,
        validate: {
          isInt: true,
          max: FRIEND_SCORE.MAX
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
      ]
    }
  )

  const classMethods = [
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
  ]
  const instanceMethods = [ toFormatedJSON ]
  addMethodsToModel(Pod, classMethods, instanceMethods)

  return Pod
}

// ------------------------------ METHODS ------------------------------

toFormatedJSON = function () {
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
  Pod.belongsToMany(models.Request, {
    foreignKey: 'podId',
    through: models.RequestToPod,
    onDelete: 'cascade'
  })
}

countAll = function (callback) {
  return Pod.count().asCallback(callback)
}

incrementScores = function (ids, value, callback) {
  if (!callback) callback = function () { /* empty */ }

  const update = {
    score: Sequelize.literal('score +' + value)
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

  return Pod.update(update, options).asCallback(callback)
}

list = function (callback) {
  return Pod.findAll().asCallback(callback)
}

listAllIds = function (transaction, callback) {
  if (!callback) {
    callback = transaction
    transaction = null
  }

  const query: any = {
    attributes: [ 'id' ]
  }

  if (transaction) query.transaction = transaction

  return Pod.findAll(query).asCallback(function (err, pods) {
    if (err) return callback(err)

    return callback(null, map(pods, 'id'))
  })
}

listRandomPodIdsWithRequest = function (limit, tableWithPods, tableWithPodsJoins, callback) {
  if (!callback) {
    callback = tableWithPodsJoins
    tableWithPodsJoins = ''
  }

  Pod.count().asCallback(function (err, count) {
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
            Sequelize.literal(`SELECT DISTINCT "${tableWithPods}"."podId" FROM "${tableWithPods}" ${tableWithPodsJoins}`)
          ]
        }
      }
    }

    return Pod.findAll(query).asCallback(function (err, pods) {
      if (err) return callback(err)

      return callback(null, map(pods, 'id'))
    })
  })
}

listBadPods = function (callback) {
  const query = {
    where: {
      score: { $lte: 0 }
    }
  }

  return Pod.findAll(query).asCallback(callback)
}

load = function (id, callback) {
  return Pod.findById(id).asCallback(callback)
}

loadByHost = function (host, callback) {
  const query = {
    where: {
      host: host
    }
  }

  return Pod.findOne(query).asCallback(callback)
}

removeAll = function (callback) {
  return Pod.destroy().asCallback(callback)
}

updatePodsScore = function (goodPods, badPods) {
  logger.info('Updating %d good pods and %d bad pods scores.', goodPods.length, badPods.length)

  if (goodPods.length !== 0) {
    incrementScores(goodPods, PODS_SCORE.BONUS, function (err) {
      if (err) logger.error('Cannot increment scores of good pods.', { error: err })
    })
  }

  if (badPods.length !== 0) {
    incrementScores(badPods, PODS_SCORE.MALUS, function (err) {
      if (err) logger.error('Cannot decrement scores of bad pods.', { error: err })
      removeBadPods()
    })
  }
}

// ---------------------------------------------------------------------------

// Remove pods with a score of 0 (too many requests where they were unreachable)
function removeBadPods () {
  waterfall([
    function findBadPods (callback) {
      listBadPods(function (err, pods) {
        if (err) {
          logger.error('Cannot find bad pods.', { error: err })
          return callback(err)
        }

        return callback(null, pods)
      })
    },

    function removeTheseBadPods (pods, callback) {
      each(pods, function (pod: any, callbackEach) {
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
