import { MCommentAutomaticTagWithTag } from '@server/types/models/index.js'
import { Op, Transaction } from 'sequelize'
import { BelongsTo, Column, CreatedAt, ForeignKey, PrimaryKey, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel } from '../shared/index.js'
import { VideoCommentModel } from '../video/video-comment.js'
import { AutomaticTagModel } from './automatic-tag.js'

/**
 * Sequelize doesn't seem to support many to many relation using BelongsToMany with 3 tables
 * So we reproduce the behaviour with classic BelongsTo/HasMany relations
 */

@Table({
  tableName: 'commentAutomaticTag',
  indexes: [
    {
      unique: true,
      fields: [ 'commentId', 'accountId', 'automaticTagId' ]
    }
  ]
})
export class CommentAutomaticTagModel extends SequelizeModel<CommentAutomaticTagModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @ForeignKey(() => VideoCommentModel)
  @PrimaryKey
  @Column
  declare commentId: number

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

  @BelongsTo(() => VideoCommentModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  declare VideoComment: Awaited<VideoCommentModel>

  static deleteAllOfAccountAndComment (options: {
    accountId: number
    commentId: number
    transaction: Transaction
  }) {
    const { accountId, commentId, transaction } = options

    return this.destroy({
      where: { accountId, commentId },
      transaction
    })
  }

  static listByAccountIdsAndCommentId (options: {
    accountIds: number[]
    commentId: number
    transaction?: Transaction
  }) {
    const { accountIds, commentId, transaction } = options

    return CommentAutomaticTagModel.findAll<MCommentAutomaticTagWithTag>({
      where: {
        commentId,
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
