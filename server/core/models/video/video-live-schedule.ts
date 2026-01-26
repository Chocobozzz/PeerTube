import { LiveVideoSchedule } from '@peertube/peertube-models'
import { Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { SequelizeModel } from '../shared/index.js'
import { VideoLiveModel } from './video-live.js'

@Table({
  tableName: 'videoLiveSchedule',
  indexes: [
    {
      fields: [ 'liveVideoId' ]
    },
    {
      fields: [ 'startAt' ]
    }
  ]
})
export class VideoLiveScheduleModel extends SequelizeModel<VideoLiveScheduleModel> {
  @AllowNull(false)
  @Column
  declare startAt: Date

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @ForeignKey(() => VideoLiveModel)
  @Column
  declare liveVideoId: number

  @BelongsTo(() => VideoLiveModel, {
    foreignKey: {
      allowNull: true,
      name: 'liveVideoId'
    },
    as: 'LiveVideo',
    onDelete: 'cascade'
  })
  declare LiveVideo: Awaited<VideoLiveModel>

  static deleteAllOfLiveId (id: number, t?: Transaction) {
    return VideoLiveScheduleModel.destroy({
      where: {
        liveVideoId: id
      },
      transaction: t
    })
  }

  static addToLiveId (id: number, schedules: (Date | string)[], t?: Transaction): Promise<VideoLiveScheduleModel[]> {
    return Promise.all(schedules.map(startAt => {
      return VideoLiveScheduleModel.create({
        liveVideoId: id,
        startAt: new Date(startAt)
      }, { transaction: t })
    }))
  }

  toFormattedJSON (): LiveVideoSchedule {
    return {
      startAt: this.startAt
    }
  }
}
