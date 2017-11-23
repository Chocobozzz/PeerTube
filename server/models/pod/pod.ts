import { map } from 'lodash'
import * as Sequelize from 'sequelize'

import { FRIEND_SCORE, PODS_SCORE } from '../../initializers'
import { logger, isHostValid } from '../../helpers'

import { addMethodsToModel, getSort } from '../utils'
import {
  PodInstance,
  PodAttributes,

  PodMethods
} from './pod-interface'

let Pod: Sequelize.Model<PodInstance, PodAttributes>
let toFormattedJSON: PodMethods.ToFormattedJSON
let countAll: PodMethods.CountAll
let incrementScores: PodMethods.IncrementScores
let list: PodMethods.List
let listForApi: PodMethods.ListForApi
let listAllIds: PodMethods.ListAllIds
let listRandomPodIdsWithRequest: PodMethods.ListRandomPodIdsWithRequest
let listBadPods: PodMethods.ListBadPods
let load: PodMethods.Load
let loadByHost: PodMethods.LoadByHost
let removeAll: PodMethods.RemoveAll
let updatePodsScore: PodMethods.UpdatePodsScore

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  Pod = sequelize.define<PodInstance, PodAttributes>('Pod',
    {
      host: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isHost: value => {
            const res = isHostValid(value)
            if (res === false) throw new Error('Host not valid.')
          }
        }
      },
      score: {
        type: DataTypes.INTEGER,
        defaultValue: FRIEND_SCORE.BASE,
        allowNull: false,
        validate: {
          isInt: true,
          max: FRIEND_SCORE.MAX
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
    listForApi,
    listAllIds,
    listRandomPodIdsWithRequest,
    listBadPods,
    load,
    loadByHost,
    updatePodsScore,
    removeAll
  ]
  const instanceMethods = [ toFormattedJSON ]
  addMethodsToModel(Pod, classMethods, instanceMethods)

  return Pod
}

// ------------------------------ METHODS ------------------------------

toFormattedJSON = function (this: PodInstance) {
  const json = {
    id: this.id,
    host: this.host,
    score: this.score as number,
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

countAll = function () {
  return Pod.count()
}

incrementScores = function (ids: number[], value: number) {
  const update = {
    score: Sequelize.literal('score +' + value)
  }

  const options = {
    where: {
      id: {
        [Sequelize.Op.in]: ids
      }
    },
    // In this case score is a literal and not an integer so we do not validate it
    validate: false
  }

  return Pod.update(update, options)
}

list = function () {
  return Pod.findAll()
}

listForApi = function (start: number, count: number, sort: string) {
  const query = {
    offset: start,
    limit: count,
    order: [ getSort(sort) ]
  }

  return Pod.findAndCountAll(query).then(({ rows, count }) => {
    return {
      data: rows,
      total: count
    }
  })
}

listAllIds = function (transaction: Sequelize.Transaction) {
  const query = {
    attributes: [ 'id' ],
    transaction
  }

  return Pod.findAll(query).then(pods => {
    return map(pods, 'id')
  })
}

listRandomPodIdsWithRequest = function (limit: number, tableWithPods: string, tableWithPodsJoins: string) {
  return Pod.count().then(count => {
    // Optimization...
    if (count === 0) return []

    let start = Math.floor(Math.random() * count) - limit
    if (start < 0) start = 0

    const subQuery = `(SELECT DISTINCT "${tableWithPods}"."podId" FROM "${tableWithPods}" ${tableWithPodsJoins})`
    const query = {
      attributes: [ 'id' ],
      order: [
        [ 'id', 'ASC' ]
      ],
      offset: start,
      limit: limit,
      where: {
        id: {
          [Sequelize.Op.in]: Sequelize.literal(subQuery)
        }
      }
    }

    return Pod.findAll(query).then(pods => {
      return map(pods, 'id')
    })
  })
}

listBadPods = function () {
  const query = {
    where: {
      score: {
        [Sequelize.Op.lte]: 0
      }
    }
  }

  return Pod.findAll(query)
}

load = function (id: number) {
  return Pod.findById(id)
}

loadByHost = function (host: string) {
  const query = {
    where: {
      host: host
    }
  }

  return Pod.findOne(query)
}

removeAll = function () {
  return Pod.destroy()
}

updatePodsScore = function (goodPods: number[], badPods: number[]) {
  logger.info('Updating %d good pods and %d bad pods scores.', goodPods.length, badPods.length)

  if (goodPods.length !== 0) {
    incrementScores(goodPods, PODS_SCORE.BONUS).catch(err => {
      logger.error('Cannot increment scores of good pods.', err)
    })
  }

  if (badPods.length !== 0) {
    incrementScores(badPods, PODS_SCORE.PENALTY)
      .then(() => removeBadPods())
      .catch(err => {
        if (err) logger.error('Cannot decrement scores of bad pods.', err)
      })
  }
}

// ---------------------------------------------------------------------------

// Remove pods with a score of 0 (too many requests where they were unreachable)
async function removeBadPods () {
  try {
    const pods = await listBadPods()

    const podsRemovePromises = pods.map(pod => pod.destroy())
    await Promise.all(podsRemovePromises)

    const numberOfPodsRemoved = pods.length

    if (numberOfPodsRemoved) {
      logger.info('Removed %d pods.', numberOfPodsRemoved)
    } else {
      logger.info('No need to remove bad pods.')
    }
  } catch (err) {
    logger.error('Cannot remove bad pods.', err)
  }
}
