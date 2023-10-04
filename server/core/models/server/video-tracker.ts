import { Column, CreatedAt, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { VideoModel } from '../video/video.js'
import { TrackerModel } from './tracker.js'

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
