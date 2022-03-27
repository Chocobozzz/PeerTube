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

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  Video: VideoModel

  toFormattedJSON () {
    return {
      filename: this.filename
    }
  }
}
