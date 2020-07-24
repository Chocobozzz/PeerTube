import * as Bluebird from 'bluebird'
import { difference, values } from 'lodash'
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
import { ACTOR_FOLLOW_SCORE, FOLLOW_STATES, SERVER_ACTOR_NAME } from '../../initializers/constants'
import { ServerModel } from '../server/server'
import { createSafeIn, getFollowsSort, getSort, searchAttribute } from '../utils'
import { ActorModel, unusedActorAttributesForAPI } from './actor'
import { VideoChannelModel } from '../video/video-channel'
import { AccountModel } from '../account/account'
import { IncludeOptions, Op, QueryTypes, Transaction, WhereOptions } from 'sequelize'
import {
  MActorFollowActorsDefault,
  MActorFollowActorsDefaultSubscription,
  MActorFollowFollowingHost,
  MActorFollowFormattable,
  MActorFollowSubscriptions
} from '@server/types/models'
import { ActivityPubActorType } from '@shared/models'
import { VideoModel } from '@server/models/video/video'
import { getServerActor } from '@server/models/application/application'

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
  static incrementFollowerAndFollowingCount (instance: ActorFollowModel, options: any) {
    if (instance.state !== 'accepted') return undefined

    return Promise.all([
      ActorModel.rebuildFollowsCount(instance.actorId, 'following', options.transaction),
      ActorModel.rebuildFollowsCount(instance.targetActorId, 'followers', options.transaction)
    ])
  }

  @AfterDestroy
  static decrementFollowerAndFollowingCount (instance: ActorFollowModel, options: any) {
    return Promise.all([
      ActorModel.rebuildFollowsCount(instance.actorId, 'following', options.transaction),
      ActorModel.rebuildFollowsCount(instance.targetActorId, 'followers', options.transaction)
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

  static isFollowedBy (actorId: number, followerActorId: number) {
    const query = 'SELECT 1 FROM "actorFollow" WHERE "actorId" = $followerActorId AND "targetActorId" = $actorId LIMIT 1'
    const options = {
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      bind: { actorId, followerActorId },
      raw: true
    }

    return VideoModel.sequelize.query(query, options)
                     .then(results => results.length === 1)
  }

  static loadByActorAndTarget (actorId: number, targetActorId: number, t?: Transaction): Bluebird<MActorFollowActorsDefault> {
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

  static loadByActorAndTargetNameAndHostForAPI (
    actorId: number,
    targetName: string,
    targetHost: string,
    t?: Transaction
  ): Bluebird<MActorFollowActorsDefaultSubscription> {
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
        if (result?.ActorFollowing.VideoChannel) {
          result.ActorFollowing.VideoChannel.Actor = result.ActorFollowing
        }

        return result
      })
  }

  static listSubscribedIn (actorId: number, targets: { name: string, host?: string }[]): Bluebird<MActorFollowFollowingHost[]> {
    const whereTab = targets
      .map(t => {
        if (t.host) {
          return {
            [Op.and]: [
              {
                $preferredUsername$: t.name
              },
              {
                $host$: t.host
              }
            ]
          }
        }

        return {
          [Op.and]: [
            {
              $preferredUsername$: t.name
            },
            {
              $serverId$: null
            }
          ]
        }
      })

    const query = {
      attributes: [],
      where: {
        [Op.and]: [
          {
            [Op.or]: whereTab
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

  static listFollowingForApi (options: {
    id: number
    start: number
    count: number
    sort: string
    state?: FollowState
    actorType?: ActivityPubActorType
    search?: string
  }) {
    const { id, start, count, sort, search, state, actorType } = options

    const followWhere = state ? { state } : {}
    const followingWhere: WhereOptions = {}
    const followingServerWhere: WhereOptions = {}

    if (search) {
      Object.assign(followingServerWhere, {
        host: {
          [Op.iLike]: '%' + search + '%'
        }
      })
    }

    if (actorType) {
      Object.assign(followingWhere, { type: actorType })
    }

    const query = {
      distinct: true,
      offset: start,
      limit: count,
      order: getFollowsSort(sort),
      where: followWhere,
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
          where: followingWhere,
          include: [
            {
              model: ServerModel,
              required: true,
              where: followingServerWhere
            }
          ]
        }
      ]
    }

    return ActorFollowModel.findAndCountAll<MActorFollowActorsDefault>(query)
      .then(({ rows, count }) => {
        return {
          data: rows,
          total: count
        }
      })
  }

  static listFollowersForApi (options: {
    actorId: number
    start: number
    count: number
    sort: string
    state?: FollowState
    actorType?: ActivityPubActorType
    search?: string
  }) {
    const { actorId, start, count, sort, search, state, actorType } = options

    const followWhere = state ? { state } : {}
    const followerWhere: WhereOptions = {}
    const followerServerWhere: WhereOptions = {}

    if (search) {
      Object.assign(followerServerWhere, {
        host: {
          [Op.iLike]: '%' + search + '%'
        }
      })
    }

    if (actorType) {
      Object.assign(followerWhere, { type: actorType })
    }

    const query = {
      distinct: true,
      offset: start,
      limit: count,
      order: getFollowsSort(sort),
      where: followWhere,
      include: [
        {
          model: ActorModel,
          required: true,
          as: 'ActorFollower',
          where: followerWhere,
          include: [
            {
              model: ServerModel,
              required: true,
              where: followerServerWhere
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

    return ActorFollowModel.findAndCountAll<MActorFollowActorsDefault>(query)
                           .then(({ rows, count }) => {
                             return {
                               data: rows,
                               total: count
                             }
                           })
  }

  static listSubscriptionsForApi (options: {
    actorId: number
    start: number
    count: number
    sort: string
    search?: string
  }) {
    const { actorId, start, count, sort } = options
    const where = {
      actorId: actorId
    }

    if (options.search) {
      Object.assign(where, {
        [Op.or]: [
          searchAttribute(options.search, '$ActorFollowing.preferredUsername$'),
          searchAttribute(options.search, '$ActorFollowing.VideoChannel.name$')
        ]
      })
    }

    const query = {
      attributes: [],
      distinct: true,
      offset: start,
      limit: count,
      order: getSort(sort),
      where,
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

    return ActorFollowModel.findAndCountAll<MActorFollowSubscriptions>(query)
                           .then(({ rows, count }) => {
                             return {
                               data: rows.map(r => r.ActorFollowing.VideoChannel),
                               total: count
                             }
                           })
  }

  static async keepUnfollowedInstance (hosts: string[]) {
    const followerId = (await getServerActor()).id

    const query = {
      attributes: [ 'id' ],
      where: {
        actorId: followerId
      },
      include: [
        {
          attributes: [ 'id' ],
          model: ActorModel.unscoped(),
          required: true,
          as: 'ActorFollowing',
          where: {
            preferredUsername: SERVER_ACTOR_NAME
          },
          include: [
            {
              attributes: [ 'host' ],
              model: ServerModel.unscoped(),
              required: true,
              where: {
                host: {
                  [Op.in]: hosts
                }
              }
            }
          ]
        }
      ]
    }

    const res = await ActorFollowModel.findAll(query)
    const followedHosts = res.map(row => row.ActorFollowing.Server.host)

    return difference(hosts, followedHosts)
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
    if (distinct === true) selections.push(`DISTINCT("Follows"."${columnUrl}") AS "selectionUrl"`)
    else selections.push(`"Follows"."${columnUrl}" AS "selectionUrl"`)

    selections.push('COUNT(*) AS "total"')

    const tasks: Bluebird<any>[] = []

    for (const selection of selections) {
      let query = 'SELECT ' + selection + ' FROM "actor" ' +
        'INNER JOIN "actorFollow" ON "actorFollow"."' + firstJoin + '" = "actor"."id" ' +
        'INNER JOIN "actor" AS "Follows" ON "actorFollow"."' + secondJoin + '" = "Follows"."id" ' +
        `WHERE "actor"."id" = ANY ($actorIds) AND "actorFollow"."state" = 'accepted' AND "Follows"."${columnUrl}" IS NOT NULL `

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
    const urls: string[] = followers.map(f => f.selectionUrl)

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

  toFormattedJSON (this: MActorFollowFormattable): ActorFollow {
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
