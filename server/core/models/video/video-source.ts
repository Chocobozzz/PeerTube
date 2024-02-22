import { Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { VideoSource } from '@peertube/peertube-models'
import { SequelizeModel, getSort } from '../shared/index.js'
import { VideoModel } from './video.js'

@Table({
  tableName: 'videoSource',
  indexes: [
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ { name: 'createdAt', order: 'DESC' } ]
    }
  ]
})
export class VideoSourceModel extends SequelizeModel<VideoSourceModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @Column
  filename: string

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  Video: Awaited<VideoModel>

  static loadLatest (videoId: number, transaction?: Transaction) {
    return VideoSourceModel.findOne({
      where: { videoId },
      order: getSort('-createdAt'),
      transaction
    })
  }

  toFormattedJSON (): VideoSource {
    return {
      filename: this.filename,
      createdAt: this.createdAt.toISOString()
    }
  }
}
