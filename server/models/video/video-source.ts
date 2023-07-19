import { Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { VideoSource } from '@shared/models/videos/video-source'
import { AttributesOnly } from '@shared/typescript-utils'
import { getSort } from '../shared'
import { VideoModel } from './video'

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
export class VideoSourceModel extends Model<Partial<AttributesOnly<VideoSourceModel>>> {
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
  Video: VideoModel

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
