import * as Bluebird from 'bluebird'
import * as Sequelize from 'sequelize'
import { AllowNull, BelongsToMany, Column, CreatedAt, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { isVideoTagValid } from '../../helpers/custom-validators/videos'
import { throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { VideoTagModel } from './video-tag'
import { VideoPrivacy, VideoState } from '../../../shared/models/videos'

@Table({
  tableName: 'tag',
  timestamps: false,
  indexes: [
    {
      fields: [ 'name' ],
      unique: true
    }
  ]
})
export class TagModel extends Model<TagModel> {

  @AllowNull(false)
  @Is('VideoTag', value => throwIfNotValid(value, isVideoTagValid, 'tag'))
  @Column
  name: string

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @BelongsToMany(() => VideoModel, {
    foreignKey: 'tagId',
    through: () => VideoTagModel,
    onDelete: 'CASCADE'
  })
  Videos: VideoModel[]

  static findOrCreateTags (tags: string[], transaction: Sequelize.Transaction) {
    if (tags === null) return []

    const tasks: Bluebird<TagModel>[] = []
    tags.forEach(tag => {
      const query = {
        where: {
          name: tag
        },
        defaults: {
          name: tag
        },
        transaction
      }

      const promise = TagModel.findOrCreate(query)
        .then(([ tagInstance ]) => tagInstance)
      tasks.push(promise)
    })

    return Promise.all(tasks)
  }

  // threshold corresponds to how many video the field should have to be returned
  static getRandomSamples (threshold: number, count: number): Bluebird<string[]> {
    const query = 'SELECT tag.name FROM tag ' +
      'INNER JOIN "videoTag" ON "videoTag"."tagId" = tag.id ' +
      'INNER JOIN video ON video.id = "videoTag"."videoId" ' +
      'WHERE video.privacy = $videoPrivacy AND video.state = $videoState ' +
      'GROUP BY tag.name HAVING COUNT(tag.name) >= $threshold ' +
      'ORDER BY random() ' +
      'LIMIT $count'

    const options = {
      bind: { threshold, count, videoPrivacy: VideoPrivacy.PUBLIC, videoState: VideoState.PUBLISHED },
      type: Sequelize.QueryTypes.SELECT
    }
    return TagModel.sequelize.query(query, options)
                    .then(data => data.map(d => d.name))
  }
}
