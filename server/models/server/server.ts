import * as Sequelize from 'sequelize'
import { AllowNull, Column, CreatedAt, Default, Is, IsInt, Max, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { isHostValid } from '../../helpers/custom-validators/servers'
import { logger } from '../../helpers/logger'
import { SERVERS_SCORE } from '../../initializers'
import { throwIfNotValid } from '../utils'

@Table({
  tableName: 'server',
  indexes: [
    {
      fields: [ 'host' ],
      unique: true
    },
    {
      fields: [ 'score' ]
    }
  ]
})
export class ServerModel extends Model<ServerModel> {

  @AllowNull(false)
  @Is('Host', value => throwIfNotValid(value, isHostValid, 'valid host'))
  @Column
  host: string

  @AllowNull(false)
  @Default(SERVERS_SCORE.BASE)
  @IsInt
  @Max(SERVERS_SCORE.max)
  @Column
  score: number

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  static updateServersScoreAndRemoveBadOnes (goodServers: number[], badServers: number[]) {
    logger.info('Updating %d good servers and %d bad servers scores.', goodServers.length, badServers.length)

    if (goodServers.length !== 0) {
      ServerModel.incrementScores(goodServers, SERVERS_SCORE.BONUS)
        .catch(err => {
          logger.error('Cannot increment scores of good servers.', err)
        })
    }

    if (badServers.length !== 0) {
      ServerModel.incrementScores(badServers, SERVERS_SCORE.PENALTY)
        .then(() => ServerModel.removeBadServers())
        .catch(err => {
          if (err) logger.error('Cannot decrement scores of bad servers.', err)
        })

    }
  }

  // Remove servers with a score of 0 (too many requests where they were unreachable)
  private static async removeBadServers () {
    try {
      const servers = await ServerModel.listBadServers()

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

  private static incrementScores (ids: number[], value: number) {
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

    return ServerModel.update(update, options)
  }

  private static listBadServers () {
    const query = {
      where: {
        score: {
          [Sequelize.Op.lte]: 0
        }
      }
    }

    return ServerModel.findAll(query)
  }
}
