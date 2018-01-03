import * as Sequelize from 'sequelize'
import { BelongsTo, Column, CreatedAt, ForeignKey, Model, Scopes, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account'
import { ActorModel } from '../activitypub/actor'
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
    }
  ]
})
export class VideoShareModel extends Model<VideoShareModel> {
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

  static load (actorId: number, videoId: number, t: Sequelize.Transaction) {
    return VideoShareModel.scope(ScopeNames.WITH_ACTOR).findOne({
      where: {
        actorId,
        videoId
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

  static loadActorsByVideoOwner (actorOwnerId: number, t: Sequelize.Transaction) {
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
}
