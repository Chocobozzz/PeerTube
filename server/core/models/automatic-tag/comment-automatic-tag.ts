import { BelongsTo, Column, CreatedAt, ForeignKey, PrimaryKey, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel } from '../shared/index.js'
import { VideoCommentModel } from '../video/video-comment.js'
import { AutomaticTagModel } from './automatic-tag.js'
import { Transaction } from 'sequelize'

/**
 *
 * Sequelize doesn't seem to support many to many relation using BelongsToMany with 3 tables
 * So we reproduce the behaviour with classic BelongsTo/HasMany relations
 *
 */

@Table({
  tableName: 'commentAutomaticTag'
})
export class CommentAutomaticTagModel extends SequelizeModel<CommentAutomaticTagModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => VideoCommentModel)
  @PrimaryKey
  @Column
  commentId: number

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

  @BelongsTo(() => VideoCommentModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  VideoComment: Awaited<VideoCommentModel>

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
}
