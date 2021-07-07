import { AllowNull, BelongsToMany, Column, CreatedAt, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { Transaction } from 'sequelize/types'
import { MTracker } from '@server/types/models/server/tracker'
import { AttributesOnly } from '@shared/core-utils'
import { VideoModel } from '../video/video'
import { VideoTrackerModel } from './video-tracker'

@Table({
  tableName: 'tracker',
  indexes: [
    {
      fields: [ 'url' ],
      unique: true
    }
  ]
})
export class TrackerModel extends Model<Partial<AttributesOnly<TrackerModel>>> {

  @AllowNull(false)
  @Column
  url: string

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @BelongsToMany(() => VideoModel, {
    foreignKey: 'trackerId',
    through: () => VideoTrackerModel,
    onDelete: 'CASCADE'
  })
  Videos: VideoModel[]

  static listUrlsByVideoId (videoId: number) {
    const query = {
      include: [
        {
          attributes: [ 'id' ],
          model: VideoModel.unscoped(),
          required: true,
          where: { id: videoId }
        }
      ]
    }

    return TrackerModel.findAll(query)
      .then(rows => rows.map(rows => rows.url))
  }

  static findOrCreateTrackers (trackers: string[], transaction: Transaction): Promise<MTracker[]> {
    if (trackers === null) return Promise.resolve([])

    const tasks: Promise<MTracker>[] = []
    trackers.forEach(tracker => {
      const query = {
        where: {
          url: tracker
        },
        defaults: {
          url: tracker
        },
        transaction
      }

      const promise = TrackerModel.findOrCreate<MTracker>(query)
        .then(([ trackerInstance ]) => trackerInstance)
      tasks.push(promise)
    })

    return Promise.all(tasks)
  }
}
