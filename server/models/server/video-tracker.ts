import { Column, CreatedAt, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { VideoModel } from '../video/video'
import { TrackerModel } from './tracker'

@Table({
  tableName: 'videoTracker',
  indexes: [
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'trackerId' ]
    }
  ]
})
export class VideoTrackerModel extends Model {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @ForeignKey(() => TrackerModel)
  @Column
  trackerId: number
}
