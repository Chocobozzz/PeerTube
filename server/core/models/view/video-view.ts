import { MAX_SQL_DELETE_ITEMS } from '@server/initializers/constants.js'
import { literal, Op } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Table } from 'sequelize-typescript'
import { safeBulkDestroy, SequelizeModel } from '../shared/index.js'
import { VideoModel } from '../video/video.js'

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

  static removeOldRemoteViews (beforeDate: string) {
    return safeBulkDestroy(() => {
      return VideoViewModel.destroy({
        where: {
          startDate: {
            [Op.lt]: beforeDate
          },
          videoId: {
            [Op.in]: literal('(SELECT "id" FROM "video" WHERE "remote" IS TRUE)')
          }
        },
        limit: MAX_SQL_DELETE_ITEMS
      })
    })
  }

  static removeOldLocalViews (beforeDate: string) {
    return safeBulkDestroy(() => {
      return VideoViewModel.destroy({
        where: {
          startDate: {
            [Op.lt]: beforeDate
          },
          videoId: {
            [Op.in]: literal('(SELECT "id" FROM "video" WHERE "remote" IS FALSE)')
          }
        },
        limit: MAX_SQL_DELETE_ITEMS
      })
    })
  }
}
