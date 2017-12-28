import { BelongsTo, Column, CreatedAt, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { SortType } from '../../helpers/utils'
import { getSortOnModel } from '../utils'
import { VideoModel } from './video'

@Table({
  tableName: 'videoBlacklist',
  indexes: [
    {
      fields: [ 'videoId' ],
      unique: true
    }
  ]
})
export class VideoBlacklistModel extends Model<VideoBlacklistModel> {

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

  static listForApi (start: number, count: number, sort: SortType) {
    const query = {
      offset: start,
      limit: count,
      order: [ getSortOnModel(sort.sortModel, sort.sortValue) ],
      include: [ { model: VideoModel } ]
    }

    return VideoBlacklistModel.findAndCountAll(query)
      .then(({ rows, count }) => {
        return {
          data: rows,
          total: count
        }
      })
  }

  static loadByVideoId (id: number) {
    const query = {
      where: {
        videoId: id
      }
    }

    return VideoBlacklistModel.findOne(query)
  }

  toFormattedJSON () {
    const video = this.Video

    return {
      id: this.id,
      videoId: this.videoId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      name: video.name,
      uuid: video.uuid,
      description: video.description,
      duration: video.duration,
      views: video.views,
      likes: video.likes,
      dislikes: video.dislikes,
      nsfw: video.nsfw
    }
  }
}
