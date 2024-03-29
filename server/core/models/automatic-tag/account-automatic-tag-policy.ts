import { type AutomaticTagPolicyType } from '@peertube/peertube-models'
import { MAccountId } from '@server/types/models/index.js'
import { Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel, createSafeIn, doesExist } from '../shared/index.js'
import { AutomaticTagModel } from './automatic-tag.js'

@Table({
  tableName: 'accountAutomaticTagPolicy',
  indexes: [
    {
      fields: [ 'accountId', 'policy', 'automaticTagId' ],
      unique: true
    }
  ]
})
export class AccountAutomaticTagPolicyModel extends SequelizeModel<AccountAutomaticTagPolicyModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(true)
  @Column(DataType.INTEGER)
  policy: AutomaticTagPolicyType

  @ForeignKey(() => AccountModel)
  @Column
  accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  Account: Awaited<AccountModel>

  @ForeignKey(() => AutomaticTagModel)
  @Column
  automaticTagId: number

  @BelongsTo(() => AutomaticTagModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  AutomaticTag: Awaited<AutomaticTagModel>

  static async listOfAccount (account: MAccountId) {
    const rows = await this.findAll({
      where: { accountId: account.id },
      include: [
        {
          model: AutomaticTagModel,
          required: true
        }
      ]
    })

    return rows.map(r => ({ name: r.AutomaticTag.name, policy: r.policy }))
  }

  static deleteOfAccount (options: {
    account: MAccountId
    policy: AutomaticTagPolicyType
    transaction?: Transaction
  }) {
    const { account, policy, transaction } = options

    return this.destroy({
      where: { accountId: account.id, policy },
      transaction
    })
  }

  static hasPolicyOnTags (options: {
    accountId: number
    tags: string[]
    policy: AutomaticTagPolicyType
    transaction: Transaction
  }) {
    const { accountId, tags, policy, transaction } = options

    const query = `SELECT 1 FROM "accountAutomaticTagPolicy" ` +
      `INNER JOIN "automaticTag" ON "automaticTag"."id" = "accountAutomaticTagPolicy"."automaticTagId" ` +
      `WHERE "accountId" = $accountId AND "accountAutomaticTagPolicy"."policy" = $policy AND ` +
        `"automaticTag"."name" IN (${createSafeIn(this.sequelize, tags)}) ` +
      `LIMIT 1`

    return doesExist({ sequelize: this.sequelize, query, bind: { accountId, policy }, transaction })
  }
}
