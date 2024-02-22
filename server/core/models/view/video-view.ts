import { literal, Op } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Table } from 'sequelize-typescript'
import { VideoModel } from '../video/video.js'
import { SequelizeModel } from '../shared/index.js'

/**
 *
 * Aggregate views of all videos federated with our instance
 * Mainly used by the trending/hot algorithms
 *
 */

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
export class VideoViewModel extends SequelizeModel<VideoViewModel> {
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
  Video: Awaited<VideoModel>

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
