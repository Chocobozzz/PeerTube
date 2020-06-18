import { AllowNull, Column, CreatedAt, Default, HasMany, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { isHostValid } from '../../helpers/custom-validators/servers'
import { ActorModel } from '../activitypub/actor'
import { throwIfNotValid } from '../utils'
import { ServerBlocklistModel } from './server-blocklist'
import * as Bluebird from 'bluebird'
import { MServer, MServerFormattable } from '@server/types/models/server'

@Table({
  tableName: 'server',
  indexes: [
    {
      fields: [ 'host' ],
      unique: true
    }
  ]
})
export class ServerModel extends Model<ServerModel> {

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
  BlockedByAccounts: ServerBlocklistModel[]

  static load (id: number): Bluebird<MServer> {
    const query = {
      where: {
        id
      }
    }

    return ServerModel.findOne(query)
  }

  static loadByHost (host: string): Bluebird<MServer> {
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
    return this.BlockedByAccounts && this.BlockedByAccounts.length !== 0
  }

  toFormattedJSON (this: MServerFormattable) {
    return {
      host: this.host
    }
  }
}
