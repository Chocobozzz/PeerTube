import { FindOptions } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { isAbuseMessageValid } from '@server/helpers/custom-validators/abuses.js'
import { MAbuseMessage, MAbuseMessageFormattable } from '@server/types/models/index.js'
import { AbuseMessage } from '@peertube/peertube-models'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { AccountModel, ScopeNames as AccountScopeNames } from '../account/account.js'
import { getSort, throwIfNotValid } from '../shared/index.js'
import { AbuseModel } from './abuse.js'

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
export class AbuseMessageModel extends Model<Partial<AttributesOnly<AbuseMessageModel>>> {

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
  Account: Awaited<AccountModel>

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
  Abuse: Awaited<AbuseModel>

  static listForApi (abuseId: number) {
    const getQuery = (forCount: boolean) => {
      const query: FindOptions = {
        where: { abuseId },
        order: getSort('createdAt')
      }

      if (forCount !== true) {
        query.include = [
          {
            model: AccountModel.scope(AccountScopeNames.SUMMARY),
            required: false
          }
        ]
      }

      return query
    }

    return Promise.all([
      AbuseMessageModel.count(getQuery(true)),
      AbuseMessageModel.findAll(getQuery(false))
    ]).then(([ total, data ]) => ({ total, data }))
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
