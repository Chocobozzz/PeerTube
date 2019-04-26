import { AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, Model, Table } from 'sequelize-typescript'
import { VideoModel } from './video'
import * as Sequelize from 'sequelize'

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
export class VideoViewModel extends Model<VideoViewModel> {
  @CreatedAt
  createdAt: Date

  @AllowNull(false)
  @Column(Sequelize.DATE)
  startDate: Date

  @AllowNull(false)
  @Column(Sequelize.DATE)
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
          [Sequelize.Op.lt]: beforeDate
        },
        videoId: {
          [Sequelize.Op.in]: Sequelize.literal('(SELECT "id" FROM "video" WHERE "remote" IS TRUE)')
        }
      }
    }

    return VideoViewModel.destroy(query)
  }
}
