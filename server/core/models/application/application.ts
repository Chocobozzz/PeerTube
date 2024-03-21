import { getNodeABIVersion } from '@server/helpers/version.js'
import memoizee from 'memoizee'
import { AllowNull, Column, Default, DefaultScope, HasOne, IsInt, Table } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { ActorImageModel } from '../actor/actor-image.js'
import { SequelizeModel } from '../shared/index.js'

export const getServerActor = memoizee(async function () {
  const application = await ApplicationModel.load()
  if (!application) throw Error('Could not load Application from database.')

  const actor = application.Account.Actor
  actor.Account = application.Account

  const { avatars, banners } = await ActorImageModel.listActorImages(actor)
  actor.Avatars = avatars
  actor.Banners = banners

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
export class ApplicationModel extends SequelizeModel<ApplicationModel> {

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
  Account: Awaited<AccountModel>

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
