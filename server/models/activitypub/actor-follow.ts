import * as Bluebird from 'bluebird'
import { values } from 'lodash'
import {
  AfterCreate,
  AfterDestroy,
  AfterUpdate,
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  IsInt,
  Max,
  Model,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { FollowState } from '../../../shared/models/actors'
import { ActorFollow } from '../../../shared/models/actors/follow.model'
import { logger } from '../../helpers/logger'
import { getServerActor } from '../../helpers/utils'
import { ACTOR_FOLLOW_SCORE, FOLLOW_STATES } from '../../initializers/constants'
import { ServerModel } from '../server/server'
import { createSafeIn, getSort } from '../utils'
import { ActorModel, unusedActorAttributesForAPI } from './actor'
import { VideoChannelModel } from '../video/video-channel'
import { AccountModel } from '../account/account'
import { IncludeOptions, Op, Transaction, QueryTypes } from 'sequelize'

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
  @Column(DataType.ENUM(...values(FOLLOW_STATES)))
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

  static removeFollowsOf (actorId: number, t?: Transaction) {
    const query = {
      where: {
        [Op.or]: [
          {
            actorId
          },
          {
            targetActorId: actorId
          }
        ]
      },
      transaction: t
    }

    return ActorFollowModel.destroy(query)
  }

  // Remove actor follows with a score of 0 (too many requests where they were unreachable)
  static async removeBadActorFollows () {
    const actorFollows = await ActorFollowModel.listBadActorFollows()

    const actorFollowsRemovePromises = actorFollows.map(actorFollow => actorFollow.destroy())
    await Promise.all(actorFollowsRemovePromises)

    const numberOfActorFollowsRemoved = actorFollows.length

    if (numberOfActorFollowsRemoved) logger.info('Removed bad %d actor follows.', numberOfActorFollowsRemoved)
  }

  static loadByActorAndTarget (actorId: number, targetActorId: number, t?: Transaction) {
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

  static loadByActorAndTargetNameAndHostForAPI (actorId: number, targetName: string, targetHost: string, t?: Transaction) {
    const actorFollowingPartInclude: IncludeOptions = {
      model: ActorModel,
      required: true,
      as: 'ActorFollowing',
      where: {
        preferredUsername: targetName
      },
      include: [
        {
          model: VideoChannelModel.unscoped(),
          required: false
        }
      ]
    }

    if (targetHost === null) {
      actorFollowingPartInclude.where['serverId'] = null
    } else {
      actorFollowingPartInclude.include.push({
        model: ServerModel,
        required: true,
        where: {
          host: targetHost
        }
      })
    }

    const query = {
      where: {
        actorId
      },
      include: [
        actorFollowingPartInclude,
        {
          model: ActorModel,
          required: true,
          as: 'ActorFollower'
        }
      ],
      transaction: t
    }

    return ActorFollowModel.findOne(query)
      .then(result => {
        if (result && result.ActorFollowing.VideoChannel) {
          result.ActorFollowing.VideoChannel.Actor = result.ActorFollowing
        }

        return result
      })
  }

  static listSubscribedIn (actorId: number, targets: { name: string, host?: string }[]) {
    const whereTab = targets
      .map(t => {
        if (t.host) {
          return {
            [ Op.and ]: [
              {
                '$preferredUsername$': t.name
              },
              {
                '$host$': t.host
              }
            ]
          }
        }

        return {
          [ Op.and ]: [
            {
              '$preferredUsername$': t.name
            },
            {
              '$serverId$': null
            }
          ]
        }
      })

    const query = {
      attributes: [],
      where: {
        [ Op.and ]: [
          {
            [ Op.or ]: whereTab
          },
          {
            actorId
          }
        ]
      },
      include: [
        {
          attributes: [ 'preferredUsername' ],
          model: ActorModel.unscoped(),
          required: true,
          as: 'ActorFollowing',
          include: [
            {
              attributes: [ 'host' ],
              model: ServerModel.unscoped(),
              required: false
            }
          ]
        }
      ]
    }

    return ActorFollowModel.findAll(query)
  }

  static listFollowingForApi (id: number, start: number, count: number, sort: string, search?: string) {
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
          include: [
            {
              model: ServerModel,
              required: true,
              where: search ? {
                host: {
                  [Op.iLike]: '%' + search + '%'
                }
              } : undefined
            }
          ]
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

  static listFollowersForApi (actorId: number, start: number, count: number, sort: string, search?: string) {
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
          include: [
            {
              model: ServerModel,
              required: true,
              where: search ? {
                host: {
                  [ Op.iLike ]: '%' + search + '%'
                }
              } : undefined
            }
          ]
        },
        {
          model: ActorModel,
          as: 'ActorFollowing',
          required: true,
          where: {
            id: actorId
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

  static listSubscriptionsForApi (actorId: number, start: number, count: number, sort: string) {
    const query = {
      attributes: [],
      distinct: true,
      offset: start,
      limit: count,
      order: getSort(sort),
      where: {
        actorId: actorId
      },
      include: [
        {
          attributes: [ 'id' ],
          model: ActorModel.unscoped(),
          as: 'ActorFollowing',
          required: true,
          include: [
            {
              model: VideoChannelModel.unscoped(),
              required: true,
              include: [
                {
                  attributes: {
                    exclude: unusedActorAttributesForAPI
                  },
                  model: ActorModel,
                  required: true
                },
                {
                  model: AccountModel.unscoped(),
                  required: true,
                  include: [
                    {
                      attributes: {
                        exclude: unusedActorAttributesForAPI
                      },
                      model: ActorModel,
                      required: true
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }

    return ActorFollowModel.findAndCountAll(query)
                           .then(({ rows, count }) => {
                             return {
                               data: rows.map(r => r.ActorFollowing.VideoChannel),
                               total: count
                             }
                           })
  }

  static listAcceptedFollowerUrlsForAP (actorIds: number[], t: Transaction, start?: number, count?: number) {
    return ActorFollowModel.createListAcceptedFollowForApiQuery('followers', actorIds, t, start, count)
  }

  static listAcceptedFollowerSharedInboxUrls (actorIds: number[], t: Transaction) {
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

  static listAcceptedFollowingUrlsForApi (actorIds: number[], t: Transaction, start?: number, count?: number) {
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

  static updateScore (inboxUrl: string, value: number, t?: Transaction) {
    const query = `UPDATE "actorFollow" SET "score" = LEAST("score" + ${value}, ${ACTOR_FOLLOW_SCORE.MAX}) ` +
      'WHERE id IN (' +
        'SELECT "actorFollow"."id" FROM "actorFollow" ' +
        'INNER JOIN "actor" ON "actor"."id" = "actorFollow"."actorId" ' +
        `WHERE "actor"."inboxUrl" = '${inboxUrl}' OR "actor"."sharedInboxUrl" = '${inboxUrl}'` +
      ')'

    const options = {
      type: QueryTypes.BULKUPDATE,
      transaction: t
    }

    return ActorFollowModel.sequelize.query(query, options)
  }

  static async updateScoreByFollowingServers (serverIds: number[], value: number, t?: Transaction) {
    if (serverIds.length === 0) return

    const me = await getServerActor()
    const serverIdsString = createSafeIn(ActorFollowModel, serverIds)

    const query = `UPDATE "actorFollow" SET "score" = LEAST("score" + ${value}, ${ACTOR_FOLLOW_SCORE.MAX}) ` +
      'WHERE id IN (' +
        'SELECT "actorFollow"."id" FROM "actorFollow" ' +
        'INNER JOIN "actor" ON "actor"."id" = "actorFollow"."targetActorId" ' +
        `WHERE "actorFollow"."actorId" = ${me.Account.actorId} ` + // I'm the follower
        `AND "actor"."serverId" IN (${serverIdsString})` + // Criteria on followings
      ')'

    const options = {
      type: QueryTypes.BULKUPDATE,
      transaction: t
    }

    return ActorFollowModel.sequelize.query(query, options)
  }

  private static async createListAcceptedFollowForApiQuery (
    type: 'followers' | 'following',
    actorIds: number[],
    t: Transaction,
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
        type: QueryTypes.SELECT,
        transaction: t
      }
      tasks.push(ActorFollowModel.sequelize.query(query, options))
    }

    const [ followers, [ dataTotal ] ] = await Promise.all(tasks)
    const urls: string[] = followers.map(f => f.url)

    return {
      data: urls,
      total: dataTotal ? parseInt(dataTotal.total, 10) : 0
    }
  }

  private static listBadActorFollows () {
    const query = {
      where: {
        score: {
          [Op.lte]: 0
        }
      },
      logging: false
    }

    return ActorFollowModel.findAll(query)
  }

  toFormattedJSON (): ActorFollow {
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
