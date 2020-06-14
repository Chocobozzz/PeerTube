import { Column, ForeignKey, Model, Table } from 'sequelize-typescript'
import { TagModel } from './tag'
import { VideoModel } from './video'

@Table({
  tableName: 'videoTag',
  timestamps: false,
  indexes: [
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'tagId' ]
    }
  ]
})
export class VideoTagModel extends Model<VideoTagModel> {
  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @ForeignKey(() => TagModel)
  @Column
  tagId: number
}
