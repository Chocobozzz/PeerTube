import { AllowNull, Column, CreatedAt, DataType, HasMany, Table, UpdatedAt } from 'sequelize-typescript'
import { OAuthTokenModel } from './oauth-token.js'
import { SequelizeModel } from '../shared/index.js'

@Table({
  tableName: 'oAuthClient',
  indexes: [
    {
      fields: [ 'clientId' ],
      unique: true
    },
    {
      fields: [ 'clientId', 'clientSecret' ],
      unique: true
    }
  ]
})
export class OAuthClientModel extends SequelizeModel<OAuthClientModel> {
  @AllowNull(false)
  @Column
  declare clientId: string

  @AllowNull(false)
  @Column
  declare clientSecret: string

  @Column(DataType.ARRAY(DataType.STRING))
  declare grants: string[]

  @Column(DataType.ARRAY(DataType.STRING))
  declare redirectUris: string[]

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @HasMany(() => OAuthTokenModel, {
    onDelete: 'cascade'
  })
  declare OAuthTokens: Awaited<OAuthTokenModel>[]

  static countTotal () {
    return OAuthClientModel.count()
  }

  static loadFirstClient () {
    return OAuthClientModel.findOne()
  }

  static getByIdAndSecret (clientId: string, clientSecret: string) {
    const query = {
      where: {
        clientId,
        clientSecret
      }
    }

    return OAuthClientModel.findOne(query)
  }
}
