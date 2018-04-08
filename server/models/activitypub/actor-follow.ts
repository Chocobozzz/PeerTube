import * as Bluebird from 'bluebird'
import { values } from 'lodash'
import * as Sequelize from 'sequelize'
import {
  AfterCreate, AfterDestroy, AfterUpdate, AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, IsInt, Max, Model,
  Table, UpdatedAt
} from 'sequelize-typescript'
import { FollowState } from '../../../shared/models/actors'
import { AccountFollow } from '../../../shared/models/actors/follow.model'
import { logger } from '../../helpers/logger'
import { getServerActor } from '../../helpers/utils'
import { ACTOR_FOLLOW_SCORE } from '../../initializers'
import { FOLLOW_STATES } from '../../initializers/constants'
import { ServerModel } from '../server/server'
import { getSort } from '../utils'
import { ActorModel } from './actor'

@Table({
  tableName: 'actorFollow',
  indexes: [
    {
      fields: [ 'actorId' ]
    },
    {
      fields: [ 'targetActorId' ]
    },
    {
      fields: [ 'actorId', 'targetActorId' ],
      unique: true
    },
    {
      fields: [ 'score' ]
    }
  ]
})
export class ActorFollowModel extends Model<ActorFollowModel> {

  @AllowNull(false)
  @Column(DataType.ENUM(values(FOLLOW_STATES)))
  state: FollowState

  @AllowNull(false)
  @Default(ACTOR_FOLLOW_SCORE.BASE)
  @IsInt
  @Max(ACTOR_FOLLOW_SCORE.MAX)
  @Column
  score: number

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => ActorModel)
  @Column
  actorId: number

  @BelongsTo(() => ActorModel, {
    foreignKey: {
      name: 'actorId',
      allowNull: false
    },
    as: 'ActorFollower',
    onDelete: 'CASCADE'
  })
  ActorFollower: ActorModel

  @ForeignKey(() => ActorModel)
  @Column
  targetActorId: number

  @BelongsTo(() => ActorModel, {
    foreignKey: {
      name: 'targetActorId',
      allowNull: false
    },
    as: 'ActorFollowing',
    onDelete: 'CASCADE'
  })
  ActorFollowing: ActorModel

  @AfterCreate
  @AfterUpdate
  static incrementFollowerAndFollowingCount (instance: ActorFollowModel) {
    if (instance.state !== 'accepted') return undefined

    return Promise.all([
      ActorModel.incrementFollows(instance.actorId, 'followingCount', 1),
      ActorModel.incrementFollows(instance.targetActorId, 'followersCount', 1)
    ])
  }

  @AfterDestroy
  static decrementFollowerAndFollowingCount (instance: ActorFollowModel) {
    return Promise.all([
      ActorModel.incrementFollows(instance.actorId, 'followingCount',-1),
      ActorModel.incrementFollows(instance.targetActorId, 'followersCount', -1)
    ])
  }

  // Remove actor follows with a score of 0 (too many requests where they were unreachable)
  static async removeBadActorFollows () {
    const actorFollows = await ActorFollowModel.listBadActorFollows()

    const actorFollowsRemovePromises = actorFollows.map(actorFollow => actorFollow.destroy())
    await Promise.all(actorFollowsRemovePromises)

    const numberOfActorFollowsRemoved = actorFollows.length

    if (numberOfActorFollowsRemoved) logger.info('Removed bad %d actor follows.', numberOfActorFollowsRemoved)
  }

  static updateActorFollowsScore (goodInboxes: string[], badInboxes: string[], t: Sequelize.Transaction) {
    if (goodInboxes.length === 0 && badInboxes.length === 0) return

    logger.info('Updating %d good actor follows and %d bad actor follows scores.', goodInboxes.length, badInboxes.length)

    if (goodInboxes.length !== 0) {
      ActorFollowModel.incrementScores(goodInboxes, ACTOR_FOLLOW_SCORE.BONUS, t)
        .catch(err => logger.error('Cannot increment scores of good actor follows.', { err }))
    }

    if (badInboxes.length !== 0) {
      ActorFollowModel.incrementScores(badInboxes, ACTOR_FOLLOW_SCORE.PENALTY, t)
        .catch(err => logger.error('Cannot decrement scores of bad actor follows.', { err }))
    }
  }

  static loadByActorAndTarget (actorId: number, targetActorId: number, t?: Sequelize.Transaction) {
    const query = {
      where: {
        actorId,
        targetActorId: targetActorId
      },
      include: [
        {
          model: ActorModel,
          required: true,
          as: 'ActorFollower'
        },
        {
          model: ActorModel,
          required: true,
          as: 'ActorFollowing'
        }
      ],
      transaction: t
    }

    return ActorFollowModel.findOne(query)
  }

  static loadByActorAndTargetHost (actorId: number, targetHost: string, t?: Sequelize.Transaction) {
    const query = {
      where: {
        actorId
      },
      include: [
        {
          model: ActorModel,
          required: true,
          as: 'ActorFollower'
        },
        {
          model: ActorModel,
          required: true,
          as: 'ActorFollowing',
          include: [
            {
              model: ServerModel,
              required: true,
              where: {
                host: targetHost
              }
            }
          ]
        }
      ],
      transaction: t
    }

    return ActorFollowModel.findOne(query)
  }

  static listFollowingForApi (id: number, start: number, count: number, sort: string) {
    const query = {
      distinct: true,
      offset: start,
      limit: count,
      order: getSort(sort),
      include: [
        {
          model: ActorModel,
          required: true,
          as: 'ActorFollower',
          where: {
            id
          }
        },
        {
          model: ActorModel,
          as: 'ActorFollowing',
          required: true,
          include: [ ServerModel ]
        }
      ]
    }

    return ActorFollowModel.findAndCountAll(query)
      .then(({ rows, count }) => {
        return {
          data: rows,
          total: count
        }
      })
  }

  static listFollowersForApi (id: number, start: number, count: number, sort: string) {
    const query = {
      distinct: true,
      offset: start,
      limit: count,
      order: getSort(sort),
      include: [
        {
          model: ActorModel,
          required: true,
          as: 'ActorFollower',
          include: [ ServerModel ]
        },
        {
          model: ActorModel,
          as: 'ActorFollowing',
          required: true,
          where: {
            id
          }
        }
      ]
    }

    return ActorFollowModel.findAndCountAll(query)
      .then(({ rows, count }) => {
        return {
          data: rows,
          total: count
        }
      })
  }

  static listAcceptedFollowerUrlsForApi (actorIds: number[], t: Sequelize.Transaction, start?: number, count?: number) {
    return ActorFollowModel.createListAcceptedFollowForApiQuery('followers', actorIds, t, start, count)
  }

  static listAcceptedFollowerSharedInboxUrls (actorIds: number[], t: Sequelize.Transaction) {
    return ActorFollowModel.createListAcceptedFollowForApiQuery(
      'followers',
      actorIds,
      t,
      undefined,
      undefined,
      'sharedInboxUrl',
      true
    )
  }

  static listAcceptedFollowingUrlsForApi (actorIds: number[], t: Sequelize.Transaction, start?: number, count?: number) {
    return ActorFollowModel.createListAcceptedFollowForApiQuery('following', actorIds, t, start, count)
  }

  static async getStats () {
    const serverActor = await getServerActor()

    const totalInstanceFollowing = await ActorFollowModel.count({
      where: {
        actorId: serverActor.id
      }
    })

    const totalInstanceFollowers = await ActorFollowModel.count({
      where: {
        targetActorId: serverActor.id
      }
    })

    return {
      totalInstanceFollowing,
      totalInstanceFollowers
    }
  }

  private static async createListAcceptedFollowForApiQuery (
    type: 'followers' | 'following',
    actorIds: number[],
    t: Sequelize.Transaction,
    start?: number,
    count?: number,
    columnUrl = 'url',
    distinct = false
  ) {
    let firstJoin: string
    let secondJoin: string

    if (type === 'followers') {
      firstJoin = 'targetActorId'
      secondJoin = 'actorId'
    } else {
      firstJoin = 'actorId'
      secondJoin = 'targetActorId'
    }

    const selections: string[] = []
    if (distinct === true) selections.push('DISTINCT("Follows"."' + columnUrl + '") AS "url"')
    else selections.push('"Follows"."' + columnUrl + '" AS "url"')

    selections.push('COUNT(*) AS "total"')

    const tasks: Bluebird<any>[] = []

    for (let selection of selections) {
      let query = 'SELECT ' + selection + ' FROM "actor" ' +
        'INNER JOIN "actorFollow" ON "actorFollow"."' + firstJoin + '" = "actor"."id" ' +
        'INNER JOIN "actor" AS "Follows" ON "actorFollow"."' + secondJoin + '" = "Follows"."id" ' +
        'WHERE "actor"."id" = ANY ($actorIds) AND "actorFollow"."state" = \'accepted\' '

      if (count !== undefined) query += 'LIMIT ' + count
      if (start !== undefined) query += ' OFFSET ' + start

      const options = {
        bind: { actorIds },
        type: Sequelize.QueryTypes.SELECT,
        transaction: t
      }
      tasks.push(ActorFollowModel.sequelize.query(query, options))
    }

    const [ followers, [ { total } ] ] = await
    Promise.all(tasks)
    const urls: string[] = followers.map(f => f.url)

    return {
      data: urls,
      total: parseInt(total, 10)
    }
  }

  private static incrementScores (inboxUrls: string[], value: number, t: Sequelize.Transaction) {
    const inboxUrlsString = inboxUrls.map(url => `'${url}'`).join(',')

    const query = `UPDATE "actorFollow" SET "score" = LEAST("score" + ${value}, ${ACTOR_FOLLOW_SCORE.MAX}) ` +
      'WHERE id IN (' +
        'SELECT "actorFollow"."id" FROM "actorFollow" ' +
        'INNER JOIN "actor" ON "actor"."id" = "actorFollow"."actorId" ' +
        'WHERE "actor"."inboxUrl" IN (' + inboxUrlsString + ') OR "actor"."sharedInboxUrl" IN (' + inboxUrlsString + ')' +
      ')'

    const options = {
      type: Sequelize.QueryTypes.BULKUPDATE,
      transaction: t
    }

    return ActorFollowModel.sequelize.query(query, options)
  }

  private static listBadActorFollows () {
    const query = {
      where: {
        score: {
          [Sequelize.Op.lte]: 0
        }
      },
      logging: false
    }

    return ActorFollowModel.findAll(query)
  }

  toFormattedJSON (): AccountFollow {
    const follower = this.ActorFollower.toFormattedJSON()
    const following = this.ActorFollowing.toFormattedJSON()

    return {
      id: this.id,
      follower,
      following,
      score: this.score,
      state: this.state,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
