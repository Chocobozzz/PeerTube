import { Column, CreatedAt, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { AutorModel } from './autor'
import { VideoModel } from './video'

@Table({
  tableName: 'videoAutor',
  indexes: [
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'autorId' ]
    }
  ]
})
export class VideoAutorModel extends Model<VideoAutorModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @ForeignKey(() => AutorModel)
  @Column
  autorId: number
}
