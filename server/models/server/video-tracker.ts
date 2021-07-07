import { Column, CreatedAt, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { AttributesOnly } from '@shared/core-utils'
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
export class VideoTrackerModel extends Model<Partial<AttributesOnly<VideoTrackerModel>>> {
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
