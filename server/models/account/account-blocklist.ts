import { BelongsTo, Column, CreatedAt, ForeignKey, Model, Scopes, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from './account'
import { getSort } from '../utils'
import { AccountBlock } from '../../../shared/models/blocklist'

enum ScopeNames {
  WITH_ACCOUNTS = 'WITH_ACCOUNTS'
}

@Scopes({
  [ScopeNames.WITH_ACCOUNTS]: {
    include: [
      {
        model: () => AccountModel,
        required: true,
        as: 'ByAccount'
      },
      {
        model: () => AccountModel,
        required: true,
        as: 'BlockedAccount'
      }
    ]
  }
})

@Table({
  tableName: 'accountBlocklist',
  indexes: [
    {
      fields: [ 'accountId', 'targetAccountId' ],
      unique: true
    },
    {
      fields: [ 'targetAccountId' ]
    }
  ]
})
export class AccountBlocklistModel extends Model<AccountBlocklistModel> {

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
      allowNull: false
    },
    as: 'ByAccount',
    onDelete: 'CASCADE'
  })
  ByAccount: AccountModel

  @ForeignKey(() => AccountModel)
  @Column
  targetAccountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      name: 'targetAccountId',
      allowNull: false
    },
    as: 'BlockedAccount',
    onDelete: 'CASCADE'
  })
  BlockedAccount: AccountModel

  static loadByAccountAndTarget (accountId: number, targetAccountId: number) {
    const query = {
      where: {
        accountId,
        targetAccountId
      }
    }

    return AccountBlocklistModel.findOne(query)
  }

  static listForApi (accountId: number, start: number, count: number, sort: string) {
    const query = {
      offset: start,
      limit: count,
      order: getSort(sort),
      where: {
        accountId
      }
    }

    return AccountBlocklistModel
      .scope([ ScopeNames.WITH_ACCOUNTS ])
      .findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  toFormattedJSON (): AccountBlock {
    return {
      byAccount: this.ByAccount.toFormattedJSON(),
      blockedAccount: this.BlockedAccount.toFormattedJSON(),
      createdAt: this.createdAt
    }
  }
}
