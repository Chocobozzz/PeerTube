import { forceNumber } from '@peertube/peertube-core-utils'
import { literal, Op, QueryTypes, Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Is, Scopes, Table, UpdatedAt } from 'sequelize-typescript'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc.js'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants.js'
import { MActorDefault, MActorFollowersUrl, MActorId } from '../../types/models/index.js'
import { MVideoShareActor, MVideoShareFull } from '../../types/models/video/index.js'
import { ActorModel } from '../actor/actor.js'
import { buildLocalActorIdsIn, SequelizeModel, throwIfNotValid } from '../shared/index.js'
import { VideoModel } from './video.js'

enum ScopeNames {
  FULL = 'FULL',
  WITH_ACTOR = 'WITH_ACTOR'
}

@Scopes(() => ({
  [ScopeNames.FULL]: {
    include: [
      {
        model: ActorModel,
        required: true
      },
      {
        model: VideoModel,
        required: true
      }
    ]
  },
  [ScopeNames.WITH_ACTOR]: {
    include: [
      {
        model: ActorModel,
        required: true
      }
    ]
  }
}))
@Table({
  tableName: 'videoShare',
  indexes: [
    {
      fields: [ 'actorId' ]
    },
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'url' ],
      unique: true
    }
  ]
})
export class VideoShareModel extends SequelizeModel<VideoShareModel> {
  @AllowNull(false)
  @Is('VideoShareUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_SHARE.URL.max))
  declare url: string

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @ForeignKey(() => ActorModel)
  @Column
  declare actorId: number

  @BelongsTo(() => ActorModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare Actor: Awaited<ActorModel>

  @ForeignKey(() => VideoModel)
  @Column
  declare videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare Video: Awaited<VideoModel>

  static load (actorId: number | string, videoId: number | string, t?: Transaction): Promise<MVideoShareActor> {
    return VideoShareModel.scope(ScopeNames.WITH_ACTOR).findOne({
      where: {
        actorId,
        videoId
      },
      transaction: t
    })
  }

  static loadByUrl (url: string, t: Transaction): Promise<MVideoShareFull> {
    return VideoShareModel.scope(ScopeNames.FULL).findOne({
      where: {
        url
      },
      transaction: t
    })
  }

  static listActorIdsAndFollowerUrlsByShare (videoId: number, t: Transaction) {
    const query = `SELECT "actor"."id" AS "id", "actor"."followersUrl" AS "followersUrl" ` +
      `FROM "videoShare" ` +
      `INNER JOIN "actor" ON "actor"."id" = "videoShare"."actorId" ` +
      `WHERE "videoShare"."videoId" = :videoId`

    const options = {
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      replacements: { videoId },
      transaction: t
    }

    return VideoShareModel.sequelize.query<MActorId & MActorFollowersUrl>(query, options)
  }

  static listActorsWhoSharedVideosOf (options: {
    actorOwnerId: number
    transaction: Transaction
  }): Promise<MActorDefault[]> {
    const safeOwnerId = forceNumber(options.actorOwnerId)

    // /!\ On actor model
    const query = {
      where: {
        [Op.and]: [
          literal(
            `EXISTS (` +
              `  SELECT 1 FROM "videoShare" ` +
              `  INNER JOIN "video" ON "videoShare"."videoId" = "video"."id" ` +
              `  INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ` +
              `  INNER JOIN "account" ON "account"."id" = "videoChannel"."accountId" ` +
              `  INNER JOIN "actor" ON "actor"."accountId" = "account"."id" ` +
              `  WHERE "videoShare"."actorId" = "ActorModel"."id" AND "actor"."id" = ${safeOwnerId} ` +
              `  LIMIT 1` +
              `)`
          )
        ]
      },
      transaction: options.transaction
    }

    return ActorModel.findAll(query)
  }

  static listActorsByVideoChannel (options: {
    channelId: number
    transaction: Transaction
  }): Promise<MActorDefault[]> {
    const safeChannelId = forceNumber(options.channelId)

    // /!\ On actor model
    const query = {
      where: {
        [Op.and]: [
          literal(
            `EXISTS (` +
              `  SELECT 1 FROM "videoShare" ` +
              `  INNER JOIN "video" ON "videoShare"."videoId" = "video"."id" ` +
              `  WHERE "videoShare"."actorId" = "ActorModel"."id" AND "video"."channelId" = ${safeChannelId} ` +
              `  LIMIT 1` +
              `)`
          )
        ]
      },
      transaction: options.transaction
    }

    return ActorModel.findAll(query)
  }

  static listAndCountByVideoId (videoId: number, start: number, count: number, t?: Transaction) {
    const query = {
      offset: start,
      limit: count,
      where: {
        videoId
      },
      transaction: t
    }

    return Promise.all([
      VideoShareModel.count(query),
      VideoShareModel.findAll(query)
    ]).then(([ total, data ]) => ({ total, data }))
  }

  static listRemoteShareUrlsOfLocalVideos () {
    const query = `SELECT "videoShare".url FROM "videoShare" ` +
      `INNER JOIN actor ON actor.id = "videoShare"."actorId" AND actor."serverId" IS NOT NULL ` +
      `INNER JOIN video ON video.id = "videoShare"."videoId" AND video.remote IS FALSE`

    return VideoShareModel.sequelize.query<{ url: string }>(query, {
      type: QueryTypes.SELECT,
      raw: true
    }).then(rows => rows.map(r => r.url))
  }

  static cleanOldSharesOf (videoId: number, beforeUpdatedAt: Date) {
    const query = {
      where: {
        updatedAt: {
          [Op.lt]: beforeUpdatedAt
        },
        videoId,
        actorId: {
          [Op.notIn]: buildLocalActorIdsIn()
        }
      }
    }

    return VideoShareModel.destroy(query)
  }
}
