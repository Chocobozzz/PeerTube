import * as Bluebird from 'bluebird'
import * as Sequelize from 'sequelize'
import { AllowNull, BelongsToMany, Column, CreatedAt, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { isVideoAutorValid } from '../../helpers/custom-validators/videos'
import { throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { VideoAutorModel } from './video-autor'
import { VideoPrivacy, VideoState } from '../../../shared/models/videos'

@Table({
  tableName: 'autor',
  timestamps: false,
  indexes: [
    {
      fields: [ 'name' ],
      unique: true
    }
  ]
})
export class AutorModel extends Model<AutorModel> {

  @AllowNull(false)
  @Is('VideoAutor', value => throwIfNotValid(value, isVideoAutorValid, 'autor'))
  @Column
  name: string

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @BelongsToMany(() => VideoModel, {
    foreignKey: 'autorId',
    through: () => VideoAutorModel,
    onDelete: 'CASCADE'
  })
  Videos: VideoModel[]

  static findOrCreateAutors (autors: string[], transaction: Sequelize.Transaction) {
    if (autors === null) return []

    const tasks: Bluebird<AutorModel>[] = []
    autors.forEach(autor => {
      const query = {
        where: {
          name: autor
        },
        defaults: {
          name: autor
        },
        transaction
      }

      const promise = AutorModel.findOrCreate(query)
        .then(([ autorInstance ]) => autorInstance)
      tasks.push(promise)
    })

    return Promise.all(tasks)
  }


}
