import { CONFIG } from '@server/initializers/config.js'
import { createHmac } from 'crypto'
import { Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { SequelizeModel } from '../shared/index.js'
import { UserModel } from './user.js'

/**
 * Store the devices (IP + user agent) already seen for a particular user, so we can detect a login from a new device.
 * Only a keyed hash of these information is stored to avoid keeping private information of our users.
 */

@Table({
  tableName: 'userLoginDevice',
  indexes: [
    {
      fields: [ 'userId', 'fingerprint' ],
      unique: true
    }
  ]
})
export class UserLoginDeviceModel extends SequelizeModel<UserLoginDeviceModel> {
  @AllowNull(false)
  @Column
  declare fingerprint: string

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @ForeignKey(() => UserModel)
  @Column
  declare userId: number

  @BelongsTo(() => UserModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare User: Awaited<UserModel>

  // ---------------------------------------------------------------------------

  // Returns true if the device was not already known for this user
  static async registerDevice (options: {
    userId: number
    ip: string
    userAgent: string
    transaction?: Transaction
  }) {
    const { userId, ip, userAgent, transaction } = options

    const fingerprint = this.buildFingerprint({ ip, userAgent })

    const [ , created ] = await UserLoginDeviceModel.findOrCreate({
      where: { userId, fingerprint },
      defaults: { userId, fingerprint },
      transaction
    })

    return created
  }

  static removeUserDevices (userId: number, transaction?: Transaction) {
    return UserLoginDeviceModel.destroy({ where: { userId }, transaction })
  }

  private static buildFingerprint (options: {
    ip: string
    userAgent: string
  }) {
    const { ip, userAgent } = options

    return createHmac('sha256', CONFIG.SECRETS.PEERTUBE)
      .update(`${ip || ''}|${userAgent || ''}`)
      .digest('hex')
  }
}
