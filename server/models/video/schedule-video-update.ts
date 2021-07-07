import { Op, Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, Default, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { MScheduleVideoUpdateFormattable, MScheduleVideoUpdate } from '@server/types/models'
import { AttributesOnly } from '@shared/core-utils'
import { VideoPrivacy } from '../../../shared/models/videos'
import { VideoModel } from './video'

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
export class ScheduleVideoUpdateModel extends Model<Partial<AttributesOnly<ScheduleVideoUpdateModel>>> {

  @AllowNull(false)
  @Default(null)
  @Column
  updateAt: Date

  @AllowNull(true)
  @Default(null)
  @Column
  privacy: VideoPrivacy.PUBLIC | VideoPrivacy.UNLISTED | VideoPrivacy.INTERNAL

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
          [Op.lte]: new Date()
        }
      }
    }

    return ScheduleVideoUpdateModel.findOne(query)
      .then(res => !!res)
  }

  static listVideosToUpdate (transaction?: Transaction) {
    const query = {
      where: {
        updateAt: {
          [Op.lte]: new Date()
        }
      },
      transaction
    }

    return ScheduleVideoUpdateModel.findAll<MScheduleVideoUpdate>(query)
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

  toFormattedJSON (this: MScheduleVideoUpdateFormattable) {
    return {
      updateAt: this.updateAt,
      privacy: this.privacy || undefined
    }
  }
}
