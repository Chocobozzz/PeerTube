import { Column, CreatedAt, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { TagModel } from './tag.js'
import { VideoModel } from './video.js'
import { SequelizeModel } from '../shared/index.js'

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
export class VideoTagModel extends SequelizeModel<VideoTagModel> {
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
