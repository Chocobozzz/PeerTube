import { difference } from 'lodash'
import { Attributes, FindOptions, Includeable, IncludeOptions, Op, QueryTypes, Transaction, WhereAttributeHash } from 'sequelize'
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
  Is,
  IsInt,
  Max,
  Model,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { isActivityPubUrlValid } from '@server/helpers/custom-validators/activitypub/misc'
import { afterCommitIfTransaction } from '@server/helpers/database-utils'
import { getServerActor } from '@server/models/application/application'
import {
  MActor,
  MActorFollowActors,
  MActorFollowActorsDefault,
  MActorFollowActorsDefaultSubscription,
  MActorFollowFollowingHost,
  MActorFollowFormattable,
  MActorFollowSubscriptions
} from '@server/types/models'
import { AttributesOnly } from '@shared/typescript-utils'
import { FollowState } from '../../../shared/models/actors'
import { ActorFollow } from '../../../shared/models/actors/follow.model'
import { logger } from '../../helpers/logger'
import { ACTOR_FOLLOW_SCORE, CONSTRAINTS_FIELDS, FOLLOW_STATES, SERVER_ACTOR_NAME, SORTABLE_COLUMNS } from '../../initializers/constants'
import { AccountModel } from '../account/account'
import { ServerModel } from '../server/server'
import { doesExist } from '../shared/query'
import { createSafeIn, getSort, searchAttribute, throwIfNotValid } from '../utils'
import { VideoChannelModel } from '../video/video-channel'
import { ActorModel, unusedActorAttributesForAPI } from './actor'
import { InstanceListFollowersQueryBuilder, ListFollowersOptions } from './sql/instance-list-followers-query-builder'
import { InstanceListFollowingQueryBuilder, ListFollowingOptions } from './sql/instance-list-following-query-builder'

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
    },
    {
      fields: [ 'url' ],
      unique: true
    }
  ]
})
export class ActorFollowModel extends Model<Partial<AttributesOnly<ActorFollowModel>>> {

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(FOLLOW_STATES)))
  state: FollowState

  @AllowNull(false)
  @Default(ACTOR_FOLLOW_SCORE.BASE)
  @IsInt
  @Max(ACTOR_FOLLOW_SCORE.MAX)
  @Column
  score: number

  // Allow null because we added this column in PeerTube v3, and don't want to generate fake URLs of remote follows
  @AllowNull(true)
  @Is('ActorFollowUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.COMMONS.URL.max))
  url: string

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
    return afterCommitIfTransaction(options.transaction, () => {
      return Promise.all([
        ActorModel.rebuildFollowsCount(instance.actorId, 'following'),
        ActorModel.rebuildFollowsCount(instance.targetActorId, 'followers')
      ])
    })
  }

  @AfterDestroy
  static decrementFollowerAndFollowingCount (instance: ActorFollowModel, options: any) {
    return afterCommitIfTransaction(options.transaction, () => {
      return Promise.all([
        ActorModel.rebuildFollowsCount(instance.actorId, 'following'),
        ActorModel.rebuildFollowsCount(instance.targetActorId, 'followers')
      ])
    })
  }

  /*
   * @deprecated Use `findOrCreateCustom` instead
  */
  static findOrCreate (): any {
    throw new Error('Must not be called')
  }

  // findOrCreate has issues with actor follow hooks
  static async findOrCreateCustom (options: {
    byActor: MActor
    targetActor: MActor
    activityId: string
    state: FollowState
    transaction: Transaction
  }): Promise<[ MActorFollowActors, boolean ]> {
    const { byActor, targetActor, activityId, state, transaction } = options

    let created = false
    let actorFollow: MActorFollowActors = await ActorFollowModel.loadByActorAndTarget(byActor.id, targetActor.id, transaction)

    if (!actorFollow) {
      created = true

      actorFollow = await ActorFollowModel.create({
        actorId: byActor.id,
        targetActorId: targetActor.id,
        url: activityId,

        state
      }, { transaction })

      actorFollow.ActorFollowing = targetActor
      actorFollow.ActorFollower = byActor
    }

    return [ actorFollow, created ]
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
    const query = `SELECT 1 FROM "actorFollow" ` +
      `WHERE "actorId" = $followerActorId AND "targetActorId" = $actorId AND "state" = 'accepted' ` +
      `LIMIT 1`

    return doesExist(query, { actorId, followerActorId })
  }

  static loadByActorAndTarget (actorId: number, targetActorId: number, t?: Transaction): Promise<MActorFollowActorsDefault> {
    const query = {
      where: {
        actorId,
        targetActorId
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

  static loadByActorAndTargetNameAndHostForAPI (options: {
    actorId: number
    targetName: string
    targetHost: string
    state?: FollowState
    transaction?: Transaction
  }): Promise<MActorFollowActorsDefaultSubscription> {
    const { actorId, targetHost, targetName, state, transaction } = options

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

    const where: WhereAttributeHash<Attributes<ActorFollowModel>> = { actorId }
    if (state) where.state = state

    const query: FindOptions<Attributes<ActorFollowModel>> = {
      where,
      include: [
        actorFollowingPartInclude,
        {
          model: ActorModel,
          required: true,
          as: 'ActorFollower'
        }
      ],
      transaction
    }

    return ActorFollowModel.findOne(query)
  }

  static listSubscriptionsOf (actorId: number, targets: { name: string, host?: string }[]): Promise<MActorFollowFollowingHost[]> {
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
      attributes: [ 'id' ],
      where: {
        [Op.and]: [
          {
            [Op.or]: whereTab
          },
          {
            state: 'accepted',
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

  static listInstanceFollowingForApi (options: ListFollowingOptions) {
    return Promise.all([
      new InstanceListFollowingQueryBuilder(this.sequelize, options).countFollowing(),
      new InstanceListFollowingQueryBuilder(this.sequelize, options).listFollowing()
    ]).then(([ total, data ]) => ({ total, data }))
  }

  static listFollowersForApi (options: ListFollowersOptions) {
    return Promise.all([
      new InstanceListFollowersQueryBuilder(this.sequelize, options).countFollowers(),
      new InstanceListFollowersQueryBuilder(this.sequelize, options).listFollowers()
    ]).then(([ total, data ]) => ({ total, data }))
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
      state: 'accepted',
      actorId
    }

    if (options.search) {
      Object.assign(where, {
        [Op.or]: [
          searchAttribute(options.search, '$ActorFollowing.preferredUsername$'),
          searchAttribute(options.search, '$ActorFollowing.VideoChannel.name$')
        ]
      })
    }

    const getQuery = (forCount: boolean) => {
      let channelInclude: Includeable[] = []

      if (forCount !== true) {
        channelInclude = [
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

      return {
        attributes: forCount === true
          ? []
          : SORTABLE_COLUMNS.USER_SUBSCRIPTIONS,
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
                include: channelInclude
              }
            ]
          }
        ]
      }
    }

    return Promise.all([
      ActorFollowModel.count(getQuery(true)),
      ActorFollowModel.findAll<MActorFollowSubscriptions>(getQuery(false))
    ]).then(([ total, rows ]) => ({
      total,
      data: rows.map(r => r.ActorFollowing.VideoChannel)
    }))
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
        actorId: serverActor.id,
        state: 'accepted'
      }
    })

    const totalInstanceFollowers = await ActorFollowModel.count({
      where: {
        targetActorId: serverActor.id,
        state: 'accepted'
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
    const serverIdsString = createSafeIn(ActorFollowModel.sequelize, serverIds)

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

    const tasks: Promise<any>[] = []

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
