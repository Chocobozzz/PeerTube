import { Op, Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { VideoPrivacy } from '@peertube/peertube-models'
import { MScheduleVideoUpdate, MScheduleVideoUpdateFormattable } from '@server/types/models/index.js'
import { VideoModel } from './video.js'
import { SequelizeModel } from '../shared/index.js'

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
export class ScheduleVideoUpdateModel extends SequelizeModel<ScheduleVideoUpdateModel> {
  @AllowNull(false)
  @Default(null)
  @Column
  declare updateAt: Date

  @AllowNull(true)
  @Default(null)
  @Column(DataType.INTEGER)
  declare privacy: typeof VideoPrivacy.PUBLIC | typeof VideoPrivacy.UNLISTED | typeof VideoPrivacy.INTERNAL

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

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
