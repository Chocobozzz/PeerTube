import { Column, CreatedAt, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { SequelizeModel } from '../shared/index.js'
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
export class VideoTagModel extends SequelizeModel<VideoTagModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @ForeignKey(() => VideoModel)
  @Column
  declare videoId: number

  @ForeignKey(() => TagModel)
  @Column
  declare tagId: number
}
