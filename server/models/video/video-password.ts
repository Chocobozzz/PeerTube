import { AllowNull, BelongsTo, Column, CreatedAt, DefaultScope, ForeignKey, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { VideoModel } from './video'
import { AttributesOnly } from '@shared/typescript-utils'
import { ResultList, VideoPassword } from '@shared/models'
import { getSort, throwIfNotValid } from '../shared'
import { FindOptions, Transaction } from 'sequelize'
import { MVideoPassword } from '@server/types/models'
import { isPasswordValid } from '@server/helpers/custom-validators/videos'
import { pick } from '@shared/core-utils'

@DefaultScope(() => ({
  include: [
    {
      model: VideoModel.unscoped(),
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

  static async countByVideoId (videoId: number, t?: Transaction) {
    const query: FindOptions = {
      where: {
        videoId
      },
      transaction: t
    }

    return VideoPasswordModel.count(query)
  }

  static async loadByIdAndVideo (options: { id: number, videoId: number, t?: Transaction }): Promise<MVideoPassword> {
    const { id, videoId, t } = options
    const query: FindOptions = {
      where: {
        id,
        videoId
      },
      transaction: t
    }

    return VideoPasswordModel.findOne(query)
  }

  static async listPasswords (options: {
    start: number
    count: number
    sort: string
    videoId: number
  }): Promise<ResultList<MVideoPassword>> {
    const { start, count, sort, videoId } = options

    const { count: total, rows: data } = await VideoPasswordModel.findAndCountAll({
      where: { videoId },
      order: getSort(sort),
      offset: start,
      limit: count
    })

    return { total, data }
  }

  static async addPasswords (passwords: string[], videoId: number, transaction?: Transaction): Promise<void> {
    for (const password of passwords) {
      await VideoPasswordModel.create({
        password,
        videoId
      }, { transaction })
    }
  }

  static async deleteAllPasswords (videoId: number, transaction?: Transaction) {
    await VideoPasswordModel.destroy({
      where: { videoId },
      transaction
    })
  }

  static async deletePassword (passwordId: number, transaction?: Transaction) {
    await VideoPasswordModel.destroy({
      where: { id: passwordId },
      transaction
    })
  }

  static async isACorrectPassword (options: {
    videoId: number
    password: string
  }) {
    const query = {
      where: pick(options, [ 'videoId', 'password' ])
    }
    return VideoPasswordModel.findOne(query)
  }

  toFormattedJSON (): VideoPassword {
    return {
      id: this.id,
      password: this.password,
      videoId: this.videoId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
