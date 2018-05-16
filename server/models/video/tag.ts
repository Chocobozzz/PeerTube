import * as Bluebird from 'bluebird'
import { Transaction } from 'sequelize'
import { AllowNull, BelongsToMany, Column, CreatedAt, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { isVideoTagValid } from '../../helpers/custom-validators/videos'
import { throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { VideoTagModel } from './video-tag'

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

  static findOrCreateTags (tags: string[], transaction: Transaction) {
    if (tags === null) return []

    const tasks: Bluebird<TagModel>[] = []
    tags.forEach(tag => {
      const query = {
        where: {
          name: tag
        },
        defaults: {
          name: tag
        }
      }

      if (transaction) query['transaction'] = transaction

      const promise = TagModel.findOrCreate(query)
        .then(([ tagInstance ]) => tagInstance)
      tasks.push(promise)
    })

    return Promise.all(tasks)
  }
}
