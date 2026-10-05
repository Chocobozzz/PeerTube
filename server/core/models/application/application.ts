import { CONFIG } from '@server/initializers/config.js'
import { LOCAL_TRACKER_URLS_KEYWORD } from '@server/initializers/constants.js'
import memoizee from 'memoizee'
import { QueryTypes } from 'sequelize'
import { AllowNull, Column, DataType, Default, DefaultScope, HasOne, IsInt, Table } from 'sequelize-typescript'
import type { PickDeep } from 'type-fest'
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

// The instance actor images can be changed by an administrator on another process of this platform
export function clearServerActorCache () {
  getServerActor.clear()
}

export function getServerAccount () {
  return getServerActor().then(actor => actor.Account)
}

type ConfigPart =
  & PickDeep<typeof CONFIG, 'OBJECT_STORAGE.STREAMING_PLAYLISTS'>
  & { TRACKER?: PickDeep<typeof CONFIG, 'TRACKER.URLS'>['TRACKER'] }

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

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare configPart: ConfigPart

  @AllowNull(false)
  @Default([])
  @Column(DataType.ARRAY(DataType.STRING))
  declare manualMigrationScriptsRun: string[]

  @HasOne(() => AccountModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  declare Account: Awaited<AccountModel>

  private static lastRunConfigPart: ConfigPart

  static countTotal () {
    return ApplicationModel.count()
  }

  static load () {
    return ApplicationModel.findOne()
  }

  static async streamingPlaylistBaseUrlChanged () {
    const application = await this.load()
    const configPart = this.lastRunConfigPart || application.configPart

    return configPart?.OBJECT_STORAGE.STREAMING_PLAYLISTS.BASE_URL !== CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS.BASE_URL
  }

  static async trackerUrlsChanged () {
    const application = await this.load()

    const previousUrls = application.configPart?.TRACKER?.URLS ?? [ LOCAL_TRACKER_URLS_KEYWORD ]

    // The order is meaningful: the first URL of a kind is the one used as `announce` in torrent files
    return previousUrls.join('\n') !== CONFIG.TRACKER.URLS.join('\n')
  }

  static async hasManualMigrationScriptRun (scriptName: string) {
    const application = await this.load()

    return application.manualMigrationScriptsRun.includes(scriptName)
  }

  static async setManualMigrationScriptRun (scriptName: string) {
    const application = await this.load()
    if (application.manualMigrationScriptsRun.includes(scriptName)) return

    application.manualMigrationScriptsRun = [ ...application.manualMigrationScriptsRun, scriptName ]
    await application.save()
  }

  static async updateConfigPart () {
    const application = await this.load()

    this.lastRunConfigPart = application.configPart

    // Tracker config is saved once the torrent files are updated
    await this.mergeConfigPart({
      OBJECT_STORAGE: {
        STREAMING_PLAYLISTS: CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS
      }
    })
  }

  static async updateTrackerUrlsConfigPart () {
    await this.mergeConfigPart({
      TRACKER: {
        URLS: CONFIG.TRACKER.URLS
      }
    })
  }

  private static async mergeConfigPart (part: Partial<ConfigPart>) {
    await ApplicationModel.sequelize.query(
      `UPDATE "application" SET "configPart" = COALESCE("configPart", '{}'::jsonb) || CAST(:part AS jsonb)`,
      { replacements: { part: JSON.stringify(part) }, type: QueryTypes.UPDATE }
    )
  }
}
