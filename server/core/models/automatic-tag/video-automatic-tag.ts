import { MVideoAutomaticTagWithTag } from '@server/types/models/automatic-tag/index.js'
import { Op, Transaction } from 'sequelize'
import { BelongsTo, Column, CreatedAt, ForeignKey, PrimaryKey, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel } from '../shared/index.js'
import { VideoModel } from '../video/video.js'
import { AutomaticTagModel } from './automatic-tag.js'

/**
 * Sequelize doesn't seem to support many to many relation using BelongsToMany with 3 tables
 * So we reproduce the behaviour with classic BelongsTo/HasMany relations
 */

@Table({
  tableName: 'videoAutomaticTag',
  indexes: [
    {
      unique: true,
      fields: [ 'videoId', 'accountId', 'automaticTagId' ]
    }
  ]
})
export class VideoAutomaticTagModel extends SequelizeModel<VideoAutomaticTagModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @ForeignKey(() => VideoModel)
  @PrimaryKey
  @Column
  declare videoId: number

  @ForeignKey(() => AutomaticTagModel)
  @PrimaryKey
  @Column
  declare automaticTagId: number

  @ForeignKey(() => AccountModel)
  @PrimaryKey
  @Column
  declare accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  declare Account: Awaited<AccountModel>

  @BelongsTo(() => AutomaticTagModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  declare AutomaticTag: Awaited<AutomaticTagModel>

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  declare Video: Awaited<VideoModel>

  static listByAccountIdsAndVideoId (options: {
    videoId: number
    accountIds: number[]
    transaction?: Transaction
  }) {
    const { accountIds, videoId, transaction } = options

    return this.findAll<MVideoAutomaticTagWithTag>({
      where: {
        videoId,
        accountId: {
          [Op.in]: accountIds
        }
      },
      include: [
        {
          model: AutomaticTagModel,
          required: true
        }
      ],
      transaction
    })
  }
}
