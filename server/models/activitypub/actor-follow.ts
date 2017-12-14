import * as Bluebird from 'bluebird'
import { values } from 'lodash'
import * as Sequelize from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { FollowState } from '../../../shared/models/actors'
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
    }
  ]
})
export class ActorFollowModel extends Model<ActorFollowModel> {

  @AllowNull(false)
  @Column(DataType.ENUM(values(FOLLOW_STATES)))
  state: FollowState

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
      order: [ getSort(sort) ],
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
      order: [ getSort(sort) ],
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
    return ActorFollowModel.createListAcceptedFollowForApiQuery('followers', actorIds, t, undefined, undefined, 'sharedInboxUrl')
  }

  static listAcceptedFollowingUrlsForApi (actorIds: number[], t: Sequelize.Transaction, start?: number, count?: number) {
    return ActorFollowModel.createListAcceptedFollowForApiQuery('following', actorIds, t, start, count)
  }

  private static async createListAcceptedFollowForApiQuery (type: 'followers' | 'following',
                                       actorIds: number[],
                                       t: Sequelize.Transaction,
                                       start?: number,
                                       count?: number,
                                       columnUrl = 'url') {
    let firstJoin: string
    let secondJoin: string

    if (type === 'followers') {
      firstJoin = 'targetActorId'
      secondJoin = 'actorId'
    } else {
      firstJoin = 'actorId'
      secondJoin = 'targetActorId'
    }

    const selections = [ '"Follows"."' + columnUrl + '" AS "url"', 'COUNT(*) AS "total"' ]
    const tasks: Bluebird<any>[] = []

    for (const selection of selections) {
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

  toFormattedJSON () {
    const follower = this.ActorFollower.toFormattedJSON()
    const following = this.ActorFollowing.toFormattedJSON()

    return {
      id: this.id,
      follower,
      following,
      state: this.state,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
