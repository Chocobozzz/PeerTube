import { Column, CreatedAt, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { TagModel } from './tag.js'
import { VideoModel } from './video.js'

@Table({
  tableName: 'videoTag',
  indexes: [
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'tagId' ]
    }
  ]
})
export class VideoTagModel extends Model<Partial<AttributesOnly<VideoTagModel>>> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @ForeignKey(() => TagModel)
  @Column
  tagId: number
}
