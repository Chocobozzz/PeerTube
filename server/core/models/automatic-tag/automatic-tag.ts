import { MAutomaticTag } from '@server/types/models/index.js'
import { Transaction, col, fn } from 'sequelize'
import { AllowNull, Column, HasMany, Table } from 'sequelize-typescript'
import { SequelizeModel } from '../shared/index.js'
import { AccountAutomaticTagPolicyModel } from './account-automatic-tag-policy.js'
import { CommentAutomaticTagModel } from './comment-automatic-tag.js'
import { VideoAutomaticTagModel } from './video-automatic-tag.js'

@Table({
  tableName: 'automaticTag',
  timestamps: false,
  indexes: [
    {
      fields: [ 'name' ],
      unique: true
    },
    {
      name: 'automatic_tag_lower_name',
      fields: [ fn('lower', col('name')) ]
    }
  ]
})
export class AutomaticTagModel extends SequelizeModel<AutomaticTagModel> {
  @AllowNull(false)
  @Column
  declare name: string

  @HasMany(() => CommentAutomaticTagModel, {
    foreignKey: 'automaticTagId',
    onDelete: 'CASCADE'
  })
  declare CommentAutomaticTags: Awaited<CommentAutomaticTagModel>[]

  @HasMany(() => VideoAutomaticTagModel, {
    foreignKey: 'automaticTagId',
    onDelete: 'CASCADE'
  })
  declare VideoAutomaticTags: Awaited<VideoAutomaticTagModel>[]

  @HasMany(() => AccountAutomaticTagPolicyModel, {
    foreignKey: {
      name: 'automaticTagId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare AccountAutomaticTagPolicies: Awaited<AccountAutomaticTagPolicyModel>[]

  static findOrCreateAutomaticTag (options: {
    tag: string
    transaction?: Transaction
  }): Promise<MAutomaticTag> {
    const { tag, transaction } = options

    const query = {
      where: {
        name: tag
      },
      defaults: {
        name: tag
      },
      transaction
    }

    return this.findOrCreate(query)
      .then(([ tagInstance ]) => tagInstance)
  }
}
