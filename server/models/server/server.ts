import * as Sequelize from 'sequelize'
import { isHostValid, logger } from '../../helpers'
import { FRIEND_SCORE, SERVERS_SCORE } from '../../initializers'
import { addMethodsToModel } from '../utils'
import { ServerAttributes, ServerInstance, ServerMethods } from './server-interface'

let Server: Sequelize.Model<ServerInstance, ServerAttributes>
let updateServersScoreAndRemoveBadOnes: ServerMethods.UpdateServersScoreAndRemoveBadOnes

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
    updateServersScoreAndRemoveBadOnes
  ]
  addMethodsToModel(Server, classMethods)

  return Server
}

// ------------------------------ Statics ------------------------------

updateServersScoreAndRemoveBadOnes = function (goodServers: number[], badServers: number[]) {
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

function incrementScores (ids: number[], value: number) {
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

function listBadServers () {
  const query = {
    where: {
      score: {
        [Sequelize.Op.lte]: 0
      }
    }
  }

  return Server.findAll(query)
}
