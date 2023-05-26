import { AllowNull, BelongsTo, Column, CreatedAt, DefaultScope, ForeignKey, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { VideoModel } from './video'
import { AttributesOnly } from '@shared/typescript-utils'
import { ResultList, VideoPassword } from '@shared/models'
import { getSort, throwIfNotValid } from '../shared'
import { FindOptions, Transaction } from 'sequelize'
import { MVideoPassword } from '@server/types/models'
import { isPasswordValid } from '@server/helpers/custom-validators/videos'

@DefaultScope(() => ({
  include: [
    {
      model: VideoModel,
      required: true
    }
  ]
}))
@Table({
  tableName: 'videoPassword',
  indexes: [
    {
      fields: [ 'videoId', 'password' ],
      unique: true
    }
  ]
})
export class VideoPasswordModel extends Model<Partial<AttributesOnly<VideoPasswordModel>>> {

  @AllowNull(false)
  @Is('VideoPassword', value => throwIfNotValid(value, isPasswordValid, 'videoPassword'))
  @Column
  password: string

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  Video: VideoModel

  static async loadByVideoId (videoId: number, t?: Transaction): Promise<MVideoPassword[]> {
    const query: FindOptions = {
      where: {
        videoId
      }
    }

    if (t !== undefined) query.transaction = t

    return await VideoPasswordModel.findAll(query)
  }

  static async loadById (id: number, t?: Transaction): Promise<MVideoPassword> {
    const query: FindOptions = {
      where: {
        id
      }
    }

    if (t !== undefined) query.transaction = t

    return VideoPasswordModel.findOne(query)
  }

  static async listPasswordsForApi (options: {
    start: number
    count: number
    sort: string
    videoId: number
  }): Promise<ResultList<VideoPasswordModel>> {
    const { start, count, sort, videoId } = options

    const { count: total, rows: data } = await VideoPasswordModel.findAndCountAll({
      where: { videoId },
      order: getSort(sort),
      offset: start,
      limit: count
    })

    return { total, data }
  }

  static async addPasswordsForApi (passwords: string[], videoId: number, transaction?: Transaction): Promise<void> {
    const options = transaction ? { transaction } : {}

    for (const password of passwords) {
      await VideoPasswordModel.create({
        password,
        videoId
      }, options)
    }
  }

  static async deletePasswordsForApi (videoId: number, transaction?: Transaction): Promise<number> {
    const options = transaction ? { transaction } : {}

    const deletedRows = await VideoPasswordModel.destroy({
      where: { videoId },
      ...options
    })

    return deletedRows
  }

  static async deletePasswordForApi (passwordId: number, transaction?: Transaction) {
    const options = transaction ? { transaction } : {}

    return await VideoPasswordModel.destroy({
      where: { id: passwordId },
      ...options
    })
  }

  static async isACorrectPassword (videoId: number, password: string) {
    const query: FindOptions = {
      where: {
        videoId,
        password
      }
    }

    return await VideoPasswordModel.count(query) === 1
  }

  toFormattedJSON (): VideoPassword {
    return {
      id: this.id,
      password: this.password,
      videoId: this.videoId
    }
  }
}
