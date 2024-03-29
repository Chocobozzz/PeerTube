import { Transaction } from 'sequelize'
import { BelongsTo, Column, CreatedAt, ForeignKey, PrimaryKey, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel } from '../shared/index.js'
import { VideoModel } from '../video/video.js'
import { AutomaticTagModel } from './automatic-tag.js'

/**
 *
 * Sequelize doesn't seem to support many to many relation using BelongsToMany with 3 tables
 * So we reproduce the behaviour with classic BelongsTo/HasMany relations
 *
 */

@Table({
  tableName: 'videoAutomaticTag'
})
export class VideoAutomaticTagModel extends SequelizeModel<VideoAutomaticTagModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => VideoModel)
  @PrimaryKey
  @Column
  videoId: number

  @ForeignKey(() => AutomaticTagModel)
  @PrimaryKey
  @Column
  automaticTagId: number

  @ForeignKey(() => AccountModel)
  @PrimaryKey
  @Column
  accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  Account: Awaited<AccountModel>

  @BelongsTo(() => AutomaticTagModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  AutomaticTag: Awaited<AutomaticTagModel>

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  Video: Awaited<VideoModel>

  static deleteAllOfAccountAndVideo (options: {
    accountId: number
    videoId: number
    transaction: Transaction
  }) {
    const { accountId, videoId, transaction } = options

    return this.destroy({
      where: { accountId, videoId },
      transaction
    })
  }
}
