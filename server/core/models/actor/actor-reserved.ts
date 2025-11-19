import { CONSTRAINTS_FIELDS } from '@server/initializers/constants.js'
import { col, fn, Transaction, where } from 'sequelize'
import { AllowNull, Column, DataType, Table, UpdatedAt } from 'sequelize-typescript'
import { SequelizeModel } from '../shared/index.js'

// ---------------------------------------------------------------------------
// For example deleted actors
// Usernames we want to reserve to prevent reuse that would break federation
// ---------------------------------------------------------------------------

@Table({
  tableName: 'actorReserved',
  indexes: [
    {
      fields: [ fn('lower', col('preferredUsername')) ],
      name: 'actor_reserved_preferred_username_lower',
      unique: true
    }
  ]
})
export class ActorReservedModel extends SequelizeModel<ActorReservedModel> {
  @AllowNull(false)
  @Column
  declare preferredUsername: string

  @AllowNull(false)
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTORS.PUBLIC_KEY.max))
  declare publicKey: string

  @AllowNull(false)
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTORS.PRIVATE_KEY.max))
  declare privateKey: string

  @AllowNull(false)
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTORS.URL.max))
  declare url: string

  @AllowNull(false)
  @Column
  actorId: number

  @AllowNull(true)
  @Column
  accountId: number

  @AllowNull(true)
  @Column
  videoChannelId: number

  @UpdatedAt
  declare updatedAt: Date

  static loadByActorId (actorId: number) {
    return this.findOne({
      where: { actorId }
    })
  }

  static loadByName (preferredUsername: string, transaction?: Transaction) {
    return this.findOne({
      where: [
        where(fn('lower', col('preferredUsername')), preferredUsername.toLowerCase())
      ],
      transaction
    })
  }
}
