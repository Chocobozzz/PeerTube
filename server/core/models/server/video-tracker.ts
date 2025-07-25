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
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @ForeignKey(() => VideoModel)
  @Column
  declare videoId: number

  @ForeignKey(() => TrackerModel)
  @Column
  declare trackerId: number
}
