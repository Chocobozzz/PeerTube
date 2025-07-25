import { literal, Op } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Table } from 'sequelize-typescript'
import { VideoModel } from '../video/video.js'
import { SequelizeModel } from '../shared/index.js'

/**
 * Aggregate views of all videos federated with our instance
 * Mainly used by the trending/hot algorithms
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
  declare createdAt: Date

  @AllowNull(false)
  @Column(DataType.DATE)
  declare startDate: Date

  @AllowNull(false)
  @Column(DataType.DATE)
  declare endDate: Date

  @AllowNull(false)
  @Column
  declare views: number

  @ForeignKey(() => VideoModel)
  @Column
  declare videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  declare Video: Awaited<VideoModel>

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
