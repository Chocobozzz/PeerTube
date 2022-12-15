import { Op } from 'sequelize'
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  ForeignKey,
  Model,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { AttributesOnly } from '@shared/typescript-utils'
import { VideoModel } from './video'

@Table({
  tableName: 'videoSource',
  indexes: [
    {
      fields: [ 'videoId' ],
      where: {
        videoId: {
          [Op.ne]: null
        }
      }
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

  @BelongsTo(() => VideoModel)
  Video: VideoModel

  static loadByVideoId (videoId) {
    return VideoSourceModel.findOne({ where: { videoId } })
  }

  toFormattedJSON () {
    return {
      filename: this.filename
    }
  }
}
