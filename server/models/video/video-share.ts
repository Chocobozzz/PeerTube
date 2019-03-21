import * as Sequelize from 'sequelize'
import * as Bluebird from 'bluebird'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Is, Model, Scopes, Table, UpdatedAt } from 'sequelize-typescript'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { CONSTRAINTS_FIELDS } from '../../initializers'
import { AccountModel } from '../account/account'
import { ActorModel } from '../activitypub/actor'
import { throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { VideoChannelModel } from './video-channel'

enum ScopeNames {
  FULL = 'FULL',
  WITH_ACTOR = 'WITH_ACTOR'
}

@Scopes({
  [ScopeNames.FULL]: {
    include: [
      {
        model: () => ActorModel,
        required: true
      },
      {
        model: () => VideoModel,
        required: true
      }
    ]
  },
  [ScopeNames.WITH_ACTOR]: {
    include: [
      {
        model: () => ActorModel,
        required: true
      }
    ]
  }
})
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

  static load (actorId: number, videoId: number, t?: Sequelize.Transaction) {
    return VideoShareModel.scope(ScopeNames.WITH_ACTOR).findOne({
      where: {
        actorId,
        videoId
      },
      transaction: t
    })
  }

  static loadByUrl (url: string, t: Sequelize.Transaction) {
    return VideoShareModel.scope(ScopeNames.FULL).findOne({
      where: {
        url
      },
      transaction: t
    })
  }

  static loadActorsByShare (videoId: number, t: Sequelize.Transaction) {
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
      .then(res => res.map(r => r.Actor))
  }

  static loadActorsWhoSharedVideosOf (actorOwnerId: number, t: Sequelize.Transaction): Bluebird<ActorModel[]> {
    const query = {
      attributes: [],
      include: [
        {
          model: ActorModel,
          required: true
        },
        {
          attributes: [],
          model: VideoModel,
          required: true,
          include: [
            {
              attributes: [],
              model: VideoChannelModel.unscoped(),
              required: true,
              include: [
                {
                  attributes: [],
                  model: AccountModel.unscoped(),
                  required: true,
                  where: {
                    actorId: actorOwnerId
                  }
                }
              ]
            }
          ]
        }
      ],
      transaction: t
    }

    return VideoShareModel.scope(ScopeNames.FULL).findAll(query)
      .then(res => res.map(r => r.Actor))
  }

  static loadActorsByVideoChannel (videoChannelId: number, t: Sequelize.Transaction): Bluebird<ActorModel[]> {
    const query = {
      attributes: [],
      include: [
        {
          model: ActorModel,
          required: true
        },
        {
          attributes: [],
          model: VideoModel,
          required: true,
          where: {
            channelId: videoChannelId
          }
        }
      ],
      transaction: t
    }

    return VideoShareModel.scope(ScopeNames.FULL)
      .findAll(query)
      .then(res => res.map(r => r.Actor))
  }

  static listAndCountByVideoId (videoId: number, start: number, count: number, t?: Sequelize.Transaction) {
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
          [Sequelize.Op.lt]: beforeUpdatedAt
        },
        videoId
      }
    }

    return VideoShareModel.destroy(query)
  }
}
