import { getNodeABIVersion } from '@server/helpers/version.js'
import { CONFIG } from '@server/initializers/config.js'
import memoizee from 'memoizee'
import { AllowNull, Column, DataType, Default, DefaultScope, HasOne, IsInt, Table } from 'sequelize-typescript'
import { PickDeep } from 'type-fest'
import { AccountModel } from '../account/account.js'
import { ActorImageModel } from '../actor/actor-image.js'
import { SequelizeModel } from '../shared/index.js'
import { UploadImageModel } from './upload-image.js'

export const getServerActor = memoizee(async function () {
  const application = await ApplicationModel.load()
  if (!application) throw Error('Could not load Application from database.')

  const actor = application.Account.Actor
  actor.Account = application.Account

  const { avatars, banners } = await ActorImageModel.listActorImages(actor)
  actor.Avatars = avatars
  actor.Banners = banners

  const uploadImages = await UploadImageModel.listByActor(actor, undefined)
  actor.UploadImages = uploadImages

  return actor
}, { promise: true })

type ConfigPart = PickDeep<typeof CONFIG, 'OBJECT_STORAGE.STREAMING_PLAYLISTS'>

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
  declare migrationVersion: number

  @AllowNull(true)
  @Column
  declare latestPeerTubeVersion: string

  @AllowNull(false)
  @Column
  declare nodeVersion: string

  @AllowNull(false)
  @Column
  declare nodeABIVersion: string

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare configPart: ConfigPart

  @HasOne(() => AccountModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  declare Account: Awaited<AccountModel>

  private static lastRunConfigPart: ConfigPart
  private static lastRunNodeABIVersion: string

  static countTotal () {
    return ApplicationModel.count()
  }

  static load () {
    return ApplicationModel.findOne()
  }

  static async nodeABIChanged () {
    const application = await this.load()

    const nodeABIVersion = this.lastRunNodeABIVersion || application.nodeABIVersion

    return nodeABIVersion !== getNodeABIVersion()
  }

  static async streamingPlaylistBaseUrlChanged () {
    const application = await this.load()
    const configPart = this.lastRunConfigPart || application.configPart

    return configPart?.OBJECT_STORAGE.STREAMING_PLAYLISTS.BASE_URL !== CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS.BASE_URL
  }

  static async updateNodeVersionsOrConfig () {
    const application = await this.load()

    this.lastRunNodeABIVersion = application.nodeABIVersion
    this.lastRunConfigPart = application.configPart

    application.nodeABIVersion = getNodeABIVersion()
    application.nodeVersion = process.version

    application.configPart = {
      OBJECT_STORAGE: {
        STREAMING_PLAYLISTS: CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS
      }
    }

    await application.save()
  }
}
