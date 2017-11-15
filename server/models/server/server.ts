import { map } from 'lodash'
import * as Sequelize from 'sequelize'

import { FRIEND_SCORE, SERVERS_SCORE } from '../../initializers'
import { logger, isHostValid } from '../../helpers'

import { addMethodsToModel, getSort } from '../utils'
import {
  ServerInstance,
  ServerAttributes,

  ServerMethods
} from './server-interface'

let Server: Sequelize.Model<ServerInstance, ServerAttributes>
let countAll: ServerMethods.CountAll
let incrementScores: ServerMethods.IncrementScores
let list: ServerMethods.List
let listForApi: ServerMethods.ListForApi
let listAllIds: ServerMethods.ListAllIds
let listRandomServerIdsWithRequest: ServerMethods.ListRandomServerIdsWithRequest
let listBadServers: ServerMethods.ListBadServers
let load: ServerMethods.Load
let loadByHost: ServerMethods.LoadByHost
let removeAll: ServerMethods.RemoveAll
let updateServersScore: ServerMethods.UpdateServersScore

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  Server = sequelize.define<ServerInstance, ServerAttributes>('Server',
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
    countAll,
    incrementScores,
    list,
    listForApi,
    listAllIds,
    listRandomServerIdsWithRequest,
    listBadServers,
    load,
    loadByHost,
    updateServersScore,
    removeAll
  ]
  addMethodsToModel(Server, classMethods)

  return Server
}

// ------------------------------ Statics ------------------------------

countAll = function () {
  return Server.count()
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

  return Server.update(update, options)
}

list = function () {
  return Server.findAll()
}

listForApi = function (start: number, count: number, sort: string) {
  const query = {
    offset: start,
    limit: count,
    order: [ getSort(sort) ]
  }

  return Server.findAndCountAll(query).then(({ rows, count }) => {
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

  return Server.findAll(query).then(servers => {
    return map(servers, 'id')
  })
}

listRandomServerIdsWithRequest = function (limit: number, tableWithServers: string, tableWithServersJoins: string) {
  return Server.count().then(count => {
    // Optimization...
    if (count === 0) return []

    let start = Math.floor(Math.random() * count) - limit
    if (start < 0) start = 0

    const subQuery = `(SELECT DISTINCT "${tableWithServers}"."serverId" FROM "${tableWithServers}" ${tableWithServersJoins})`
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

    return Server.findAll(query).then(servers => {
      return map(servers, 'id')
    })
  })
}

listBadServers = function () {
  const query = {
    where: {
      score: {
        [Sequelize.Op.lte]: 0
      }
    }
  }

  return Server.findAll(query)
}

load = function (id: number) {
  return Server.findById(id)
}

loadByHost = function (host: string) {
  const query = {
    where: {
      host: host
    }
  }

  return Server.findOne(query)
}

removeAll = function () {
  return Server.destroy()
}

updateServersScore = function (goodServers: number[], badServers: number[]) {
  logger.info('Updating %d good servers and %d bad servers scores.', goodServers.length, badServers.length)

  if (goodServers.length !== 0) {
    incrementScores(goodServers, SERVERS_SCORE.BONUS).catch(err => {
      logger.error('Cannot increment scores of good servers.', err)
    })
  }

  if (badServers.length !== 0) {
    incrementScores(badServers, SERVERS_SCORE.PENALTY)
      .then(() => removeBadServers())
      .catch(err => {
        if (err) logger.error('Cannot decrement scores of bad servers.', err)
      })
  }
}

// ---------------------------------------------------------------------------

// Remove servers with a score of 0 (too many requests where they were unreachable)
async function removeBadServers () {
  try {
    const servers = await listBadServers()

    const serversRemovePromises = servers.map(server => server.destroy())
    await Promise.all(serversRemovePromises)

    const numberOfServersRemoved = servers.length

    if (numberOfServersRemoved) {
      logger.info('Removed %d servers.', numberOfServersRemoved)
    } else {
      logger.info('No need to remove bad servers.')
    }
  } catch (err) {
    logger.error('Cannot remove bad servers.', err)
  }
}
