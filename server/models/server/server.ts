import { Transaction } from 'sequelize'
import { AllowNull, Column, CreatedAt, Default, HasMany, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { MServer, MServerFormattable } from '@server/types/models/server'
import { AttributesOnly } from '@shared/typescript-utils'
import { isHostValid } from '../../helpers/custom-validators/servers'
import { ActorModel } from '../actor/actor'
import { buildSQLAttributes, throwIfNotValid } from '../utils'
import { ServerBlocklistModel } from './server-blocklist'

@Table({
  tableName: 'server',
  indexes: [
    {
      fields: [ 'host' ],
      unique: true
    }
  ]
})
export class ServerModel extends Model<Partial<AttributesOnly<ServerModel>>> {

  @AllowNull(false)
  @Is('Host', value => throwIfNotValid(value, isHostValid, 'valid host'))
  @Column
  host: string

  @AllowNull(false)
  @Default(false)
  @Column
  redundancyAllowed: boolean

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @HasMany(() => ActorModel, {
    foreignKey: {
      name: 'serverId',
      allowNull: true
    },
    onDelete: 'CASCADE',
    hooks: true
  })
  Actors: ActorModel[]

  @HasMany(() => ServerBlocklistModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  BlockedBy: ServerBlocklistModel[]

  // ---------------------------------------------------------------------------

  static getSQLAttributes (tableName: string, aliasPrefix = '') {
    return buildSQLAttributes({
      model: this,
      tableName,
      aliasPrefix
    })
  }

  // ---------------------------------------------------------------------------

  static load (id: number, transaction?: Transaction): Promise<MServer> {
    const query = {
      where: {
        id
      },
      transaction
    }

    return ServerModel.findOne(query)
  }

  static loadByHost (host: string): Promise<MServer> {
    const query = {
      where: {
        host
      }
    }

    return ServerModel.findOne(query)
  }

  static async loadOrCreateByHost (host: string) {
    let server = await ServerModel.loadByHost(host)
    if (!server) server = await ServerModel.create({ host })

    return server
  }

  isBlocked () {
    return this.BlockedBy && this.BlockedBy.length !== 0
  }

  toFormattedJSON (this: MServerFormattable) {
    return {
      host: this.host
    }
  }
}
