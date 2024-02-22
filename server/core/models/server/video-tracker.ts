import { Column, CreatedAt, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { VideoModel } from '../video/video.js'
import { TrackerModel } from './tracker.js'
import { SequelizeModel } from '../shared/index.js'

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
export class VideoTrackerModel extends SequelizeModel<VideoTrackerModel> {
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
