import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { isAbuseMessageValid } from '@server/helpers/custom-validators/abuses'
import { AbuseMessage } from '@shared/models'
import { AccountModel, ScopeNames as AccountScopeNames } from '../account/account'
import { throwIfNotValid, getSort } from '../utils'
import { AbuseModel } from './abuse'
import { MAbuseMessageFormattable, MAbuseMessage } from '@server/types/models'

@Table({
  tableName: 'abuseMessage',
  indexes: [
    {
      fields: [ 'abuseId' ]
    },
    {
      fields: [ 'accountId' ]
    }
  ]
})
export class AbuseMessageModel extends Model<AbuseMessageModel> {

  @AllowNull(false)
  @Is('AbuseMessage', value => throwIfNotValid(value, isAbuseMessageValid, 'message'))
  @Column(DataType.TEXT)
  message: string

  @AllowNull(false)
  @Column
  byModerator: boolean

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => AccountModel)
  @Column
  accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      name: 'accountId',
      allowNull: true
    },
    onDelete: 'set null'
  })
  Account: AccountModel

  @ForeignKey(() => AbuseModel)
  @Column
  abuseId: number

  @BelongsTo(() => AbuseModel, {
    foreignKey: {
      name: 'abuseId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  Abuse: AbuseModel

  static listForApi (abuseId: number) {
    const options = {
      where: { abuseId },

      order: getSort('createdAt'),

      include: [
        {
          model: AccountModel.scope(AccountScopeNames.SUMMARY),
          required: false
        }
      ]
    }

    return AbuseMessageModel.findAndCountAll(options)
      .then(({ rows, count }) => ({ data: rows, total: count }))
  }

  static loadByIdAndAbuseId (messageId: number, abuseId: number): Promise<MAbuseMessage> {
    return AbuseMessageModel.findOne({
      where: {
        id: messageId,
        abuseId
      }
    })
  }

  toFormattedJSON (this: MAbuseMessageFormattable): AbuseMessage {
    const account = this.Account
      ? this.Account.toFormattedSummaryJSON()
      : null

    return {
      id: this.id,
      createdAt: this.createdAt,

      byModerator: this.byModerator,
      message: this.message,

      account
    }
  }
}
