import { col, fn, QueryTypes, Transaction } from 'sequelize'
import { AllowNull, BelongsToMany, Column, CreatedAt, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { VideoPrivacy, VideoState } from '@peertube/peertube-models'
import { MTag } from '@server/types/models/index.js'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { isVideoTagValid } from '../../helpers/custom-validators/videos.js'
import { throwIfNotValid } from '../shared/index.js'
import { VideoTagModel } from './video-tag.js'
import { VideoModel } from './video.js'

@Table({
  tableName: 'tag',
  timestamps: false,
  indexes: [
    {
      fields: [ 'name' ],
      unique: true
    },
    {
      name: 'tag_lower_name',
      fields: [ fn('lower', col('name')) ]
    }
  ]
})
export class TagModel extends Model<Partial<AttributesOnly<TagModel>>> {

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
  Videos: Awaited<VideoModel>[]

  static findOrCreateTags (tags: string[], transaction: Transaction): Promise<MTag[]> {
    if (tags === null) return Promise.resolve([])

    const uniqueTags = new Set(tags)

    const tasks = Array.from(uniqueTags).map(tag => {
      const query = {
        where: {
          name: tag
        },
        defaults: {
          name: tag
        },
        transaction
      }

      return TagModel.findOrCreate<MTag>(query)
        .then(([ tagInstance ]) => tagInstance)
    })

    return Promise.all(tasks)
  }

  // threshold corresponds to how many video the field should have to be returned
  static getRandomSamples (threshold: number, count: number): Promise<string[]> {
    const query = 'SELECT tag.name FROM tag ' +
      'INNER JOIN "videoTag" ON "videoTag"."tagId" = tag.id ' +
      'INNER JOIN video ON video.id = "videoTag"."videoId" ' +
      'WHERE video.privacy = $videoPrivacy AND video.state = $videoState ' +
      'GROUP BY tag.name HAVING COUNT(tag.name) >= $threshold ' +
      'ORDER BY random() ' +
      'LIMIT $count'

    const options = {
      bind: { threshold, count, videoPrivacy: VideoPrivacy.PUBLIC, videoState: VideoState.PUBLISHED },
      type: QueryTypes.SELECT as QueryTypes.SELECT
    }

    return TagModel.sequelize.query<{ name: string }>(query, options)
                    .then(data => data.map(d => d.name))
  }
}
