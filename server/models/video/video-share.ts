import * as Bluebird from 'bluebird'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Is, Model, Scopes, Table, UpdatedAt } from 'sequelize-typescript'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants'
import { ActorModel } from '../activitypub/actor'
import { buildLocalActorIdsIn, throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { literal, Op, Transaction } from 'sequelize'
import { MVideoShareActor, MVideoShareFull } from '../../types/models/video'
import { MActorDefault } from '../../types/models'

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
export class VideoShareModel extends Model<VideoShareModel> {

  @AllowNull(false)
  @Is('VideoShareUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_SHARE.URL.max))
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
      allowNull: false
    },
    onDelete: 'cascade'
  })
  Actor: ActorModel

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  Video: VideoModel

  static load (actorId: number | string, videoId: number | string, t?: Transaction): Bluebird<MVideoShareActor> {
    return VideoShareModel.scope(ScopeNames.WITH_ACTOR).findOne({
      where: {
        actorId,
        videoId
      },
      transaction: t
    })
  }

  static loadByUrl (url: string, t: Transaction): Bluebird<MVideoShareFull> {
    return VideoShareModel.scope(ScopeNames.FULL).findOne({
      where: {
        url
      },
      transaction: t
    })
  }

  static loadActorsByShare (videoId: number, t: Transaction): Bluebird<MActorDefault[]> {
    const query = {
      where: {
        videoId
      },
      include: [
        {
          model: ActorModel,
          required: true
        }
      ],
      transaction: t
    }

    return VideoShareModel.scope(ScopeNames.FULL).findAll(query)
                          .then((res: MVideoShareFull[]) => res.map(r => r.Actor))
  }

  static loadActorsWhoSharedVideosOf (actorOwnerId: number, t: Transaction): Bluebird<MActorDefault[]> {
    const safeOwnerId = parseInt(actorOwnerId + '', 10)

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
            `  WHERE "videoShare"."actorId" = "ActorModel"."id" AND "account"."actorId" = ${safeOwnerId} ` +
            `  LIMIT 1` +
            `)`
          )
        ]
      },
      transaction: t
    }

    return ActorModel.findAll(query)
  }

  static loadActorsByVideoChannel (videoChannelId: number, t: Transaction): Bluebird<MActorDefault[]> {
    const safeChannelId = parseInt(videoChannelId + '', 10)

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
      transaction: t
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

    return VideoShareModel.findAndCountAll(query)
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
