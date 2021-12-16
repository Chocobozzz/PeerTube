import { literal, Op } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Model, Table } from 'sequelize-typescript'
import { AttributesOnly } from '@shared/typescript-utils'
import { VideoModel } from './video'

@Table({
  tableName: 'videoView',
  updatedAt: false,
  indexes: [
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'startDate' ]
    }
  ]
})
export class VideoViewModel extends Model<Partial<AttributesOnly<VideoViewModel>>> {
  @CreatedAt
  createdAt: Date

  @AllowNull(false)
  @Column(DataType.DATE)
  startDate: Date

  @AllowNull(false)
  @Column(DataType.DATE)
  endDate: Date

  @AllowNull(false)
  @Column
  views: number

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  Video: VideoModel

  static removeOldRemoteViewsHistory (beforeDate: string) {
    const query = {
      where: {
        startDate: {
          [Op.lt]: beforeDate
        },
        videoId: {
          [Op.in]: literal('(SELECT "id" FROM "video" WHERE "remote" IS TRUE)')
        }
      }
    }

    return VideoViewModel.destroy(query)
  }
}
