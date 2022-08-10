import memoizee from 'memoizee'
import { AllowNull, Column, Default, DefaultScope, HasOne, IsInt, Model, Table } from 'sequelize-typescript'
import { getNodeABIVersion } from '@server/helpers/version'
import { AttributesOnly } from '@shared/typescript-utils'
import { AccountModel } from '../account/account'

export const getServerActor = memoizee(async function () {
  const application = await ApplicationModel.load()
  if (!application) throw Error('Could not load Application from database.')

  const actor = application.Account.Actor
  actor.Account = application.Account

  return actor
}, { promise: true })

@DefaultScope(() => ({
  include: [
    {
      model: AccountModel,
      required: true
    }
  ]
}))
@Table({
  tableName: 'application',
  timestamps: false
})
export class ApplicationModel extends Model<Partial<AttributesOnly<ApplicationModel>>> {

  @AllowNull(false)
  @Default(0)
  @IsInt
  @Column
  migrationVersion: number

  @AllowNull(true)
  @Column
  latestPeerTubeVersion: string

  @AllowNull(false)
  @Column
  nodeVersion: string

  @AllowNull(false)
  @Column
  nodeABIVersion: number

  @HasOne(() => AccountModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  Account: AccountModel

  static countTotal () {
    return ApplicationModel.count()
  }

  static load () {
    return ApplicationModel.findOne()
  }

  static async nodeABIChanged () {
    const application = await this.load()

    return application.nodeABIVersion !== getNodeABIVersion()
  }

  static async updateNodeVersions () {
    const application = await this.load()

    application.nodeABIVersion = getNodeABIVersion()
    application.nodeVersion = process.version

    await application.save()
  }
}
