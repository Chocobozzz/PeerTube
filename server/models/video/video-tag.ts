import { Column, CreatedAt, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { TagModel } from './tag'
import { VideoModel } from './video'

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
export class VideoTagModel extends Model {
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
