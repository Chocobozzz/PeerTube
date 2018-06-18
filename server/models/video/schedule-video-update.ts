import { AllowNull, BelongsTo, Column, CreatedAt, Default, ForeignKey, Model, Sequelize, Table, UpdatedAt } from 'sequelize-typescript'
import { ScopeNames as VideoScopeNames, VideoModel } from './video'
import { VideoPrivacy } from '../../../shared/models/videos'
import { Transaction } from 'sequelize'

@Table({
  tableName: 'scheduleVideoUpdate',
  indexes: [
    {
      fields: [ 'videoId' ],
      unique: true
    },
    {
      fields: [ 'updateAt' ]
    }
  ]
})
export class ScheduleVideoUpdateModel extends Model<ScheduleVideoUpdateModel> {

  @AllowNull(false)
  @Default(null)
  @Column
  updateAt: Date

  @AllowNull(true)
  @Default(null)
  @Column
  privacy: VideoPrivacy.PUBLIC | VideoPrivacy.UNLISTED

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

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

  static areVideosToUpdate () {
    const query = {
      logging: false,
      attributes: [ 'id' ],
      where: {
        updateAt: {
          [Sequelize.Op.lte]: new Date()
        }
      }
    }

    return ScheduleVideoUpdateModel.findOne(query)
      .then(res => !!res)
  }

  static listVideosToUpdate (t: Transaction) {
    const query = {
      where: {
        updateAt: {
          [Sequelize.Op.lte]: new Date()
        }
      },
      include: [
        {
          model: VideoModel.scope(
            [
              VideoScopeNames.WITH_FILES,
              VideoScopeNames.WITH_ACCOUNT_DETAILS
            ]
          )
        }
      ],
      transaction: t
    }

    return ScheduleVideoUpdateModel.findAll(query)
  }

  static deleteByVideoId (videoId: number, t: Transaction) {
    const query = {
      where: {
        videoId
      },
      transaction: t
    }

    return ScheduleVideoUpdateModel.destroy(query)
  }

  toFormattedJSON () {
    return {
      updateAt: this.updateAt,
      privacy: this.privacy || undefined
    }
  }
}
