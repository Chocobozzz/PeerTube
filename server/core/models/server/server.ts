import { Transaction } from 'sequelize'
import { AllowNull, Column, CreatedAt, Default, HasMany, Is, Table, UpdatedAt } from 'sequelize-typescript'
import { MServer, MServerFormattable } from '@server/types/models/server/index.js'
import { isHostValid } from '../../helpers/custom-validators/servers.js'
import { ActorModel } from '../actor/actor.js'
import { SequelizeModel, buildSQLAttributes, throwIfNotValid } from '../shared/index.js'
import { ServerBlocklistModel } from './server-blocklist.js'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'

export const serverSummaryAttributes = [ 'id', 'host' ] as const satisfies (keyof AttributesOnly<ServerModel>)[]

@Table({
  tableName: 'server',
  indexes: [
    {
      fields: [ 'host' ],
      unique: true
    }
  ]
})
export class ServerModel extends SequelizeModel<ServerModel> {
  @AllowNull(false)
  @Is('Host', value => throwIfNotValid(value, isHostValid, 'valid host'))
  @Column
  declare host: string

  @AllowNull(false)
  @Default(false)
  @Column
  declare redundancyAllowed: boolean

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @HasMany(() => ActorModel, {
    foreignKey: {
      name: 'serverId',
      allowNull: true
    },
    onDelete: 'CASCADE',
    hooks: true
  })
  declare Actors: Awaited<ActorModel>[]

  @HasMany(() => ServerBlocklistModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  declare BlockedBy: Awaited<ServerBlocklistModel>[]

  // ---------------------------------------------------------------------------

  static getSQLAttributes (tableName: string, aliasPrefix = '') {
    return buildSQLAttributes({
      model: this,
      tableName,
      aliasPrefix
    })
  }

  static getSQLSummaryAttributes (tableName: string, aliasPrefix = '') {
    return buildSQLAttributes({
      model: this,
      tableName,
      aliasPrefix,
      includeAttributes: serverSummaryAttributes
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
