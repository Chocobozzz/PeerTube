import { AllowNull, Column, CreatedAt, DataType, HasMany, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { OAuthTokenModel } from './oauth-token'

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
export class OAuthClientModel extends Model<OAuthClientModel> {

  @AllowNull(false)
  @Column
  clientId: string

  @AllowNull(false)
  @Column
  clientSecret: string

  @Column({ type: DataType.ARRAY(DataType.STRING) }) // FIXME: sequelize typings
  grants: string[]

  @Column({ type: DataType.ARRAY(DataType.STRING) }) // FIXME: sequelize typings
  redirectUris: string[]

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @HasMany(() => OAuthTokenModel, {
    onDelete: 'cascade'
  })
  OAuthTokens: OAuthTokenModel[]

  static countTotal () {
    return OAuthClientModel.count()
  }

  static loadFirstClient () {
    return OAuthClientModel.findOne()
  }

  static getByIdAndSecret (clientId: string, clientSecret: string) {
    const query = {
      where: {
        clientId: clientId,
        clientSecret: clientSecret
      }
    }

    return OAuthClientModel.findOne(query)
  }
}
