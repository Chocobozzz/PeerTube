import {
  PeerTubePlugin,
  PluginType,
  RegisterServerSettingOptions,
  SettingEntries,
  SettingValue,
  type PluginType_Type
} from '@peertube/peertube-models'
import { MPlugin, MPluginFormattable } from '@server/types/models/index.js'
import { FindAndCountOptions, QueryTypes, json } from 'sequelize'
import { AllowNull, Column, CreatedAt, DataType, DefaultScope, Is, Table, UpdatedAt } from 'sequelize-typescript'
import {
  isPluginDescriptionValid,
  isPluginHomepage,
  isPluginNameValid,
  isPluginStableOrUnstableVersionValid,
  isPluginStableVersionValid,
  isPluginTypeValid
} from '../../helpers/custom-validators/plugins.js'
import { SequelizeModel, getSort, throwIfNotValid } from '../shared/index.js'

@DefaultScope(() => ({
  attributes: {
    exclude: [ 'storage' ]
  }
}))

@Table({
  tableName: 'plugin',
  indexes: [
    {
      fields: [ 'name', 'type' ],
      unique: true
    }
  ]
})
export class PluginModel extends SequelizeModel<PluginModel> {

  @AllowNull(false)
  @Is('PluginName', value => throwIfNotValid(value, isPluginNameValid, 'name'))
  @Column
  name: string

  @AllowNull(false)
  @Is('PluginType', value => throwIfNotValid(value, isPluginTypeValid, 'type'))
  @Column
  type: PluginType_Type

  @AllowNull(false)
  @Is('PluginVersion', value => throwIfNotValid(value, isPluginStableOrUnstableVersionValid, 'version'))
  @Column
  version: string

  @AllowNull(true)
  @Is('PluginLatestVersion', value => throwIfNotValid(value, isPluginStableVersionValid, 'version'))
  @Column
  latestVersion: string

  @AllowNull(false)
  @Column
  enabled: boolean

  @AllowNull(false)
  @Column
  uninstalled: boolean

  @AllowNull(false)
  @Column
  peertubeEngine: string

  @AllowNull(true)
  @Is('PluginDescription', value => throwIfNotValid(value, isPluginDescriptionValid, 'description'))
  @Column
  description: string

  @AllowNull(false)
  @Is('PluginHomepage', value => throwIfNotValid(value, isPluginHomepage, 'homepage'))
  @Column
  homepage: string

  @AllowNull(true)
  @Column(DataType.JSONB)
  settings: any

  @AllowNull(true)
  @Column(DataType.JSONB)
  storage: any

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  static listEnabledPluginsAndThemes (): Promise<MPlugin[]> {
    const query = {
      where: {
        enabled: true,
        uninstalled: false
      }
    }

    return PluginModel.findAll(query)
  }

  static loadByNpmName (npmName: string): Promise<MPlugin> {
    const name = this.normalizePluginName(npmName)
    const type = this.getTypeFromNpmName(npmName)

    const query = {
      where: {
        name,
        type
      }
    }

    return PluginModel.findOne(query)
  }

  static getSetting (
    pluginName: string,
    pluginType: PluginType_Type,
    settingName: string,
    registeredSettings: RegisterServerSettingOptions[]
  ) {
    const query = {
      attributes: [ 'settings' ],
      where: {
        name: pluginName,
        type: pluginType
      }
    }

    return PluginModel.findOne(query)
      .then(p => {
        if (!p?.settings || p.settings === undefined) {
          const registered = registeredSettings.find(s => s.name === settingName)
          if (!registered || registered.default === undefined) return undefined

          return registered.default
        }

        return p.settings[settingName]
      })
  }

  static getSettings (
    pluginName: string,
    pluginType: PluginType_Type,
    settingNames: string[],
    registeredSettings: RegisterServerSettingOptions[]
  ) {
    const query = {
      attributes: [ 'settings' ],
      where: {
        name: pluginName,
        type: pluginType
      }
    }

    return PluginModel.findOne(query)
      .then(p => {
        const result: SettingEntries = {}

        for (const name of settingNames) {
          if (!p?.settings || p.settings[name] === undefined) {
            const registered = registeredSettings.find(s => s.name === name)

            if (registered?.default !== undefined) {
              result[name] = registered.default
            }
          } else {
            result[name] = p.settings[name]
          }
        }

        return result
      })
  }

  static setSetting (pluginName: string, pluginType: PluginType_Type, settingName: string, settingValue: SettingValue) {
    const query = {
      where: {
        name: pluginName,
        type: pluginType
      }
    }

    const toSave = {
      [`settings.${settingName}`]: settingValue
    }

    return PluginModel.update(toSave, query)
      .then(() => undefined)
  }

  static getData (pluginName: string, pluginType: PluginType_Type, key: string) {
    const query = {
      raw: true,
      attributes: [ [ json('storage.' + key), 'value' ] as any ], // FIXME: typings
      where: {
        name: pluginName,
        type: pluginType
      }
    }

    return PluginModel.findOne(query)
      .then((c: any) => {
        if (!c) return undefined
        const value = c.value

        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      })
  }

  static storeData (pluginName: string, pluginType: PluginType_Type, key: string, data: any) {
    const query = 'UPDATE "plugin" SET "storage" = jsonb_set(coalesce("storage", \'{}\'), :key, :data::jsonb) ' +
    'WHERE "name" = :pluginName AND "type" = :pluginType'

    const jsonPath = '{' + key + '}'

    const options = {
      replacements: { pluginName, pluginType, key: jsonPath, data: JSON.stringify(data) },
      type: QueryTypes.UPDATE
    }

    return PluginModel.sequelize.query(query, options)
                      .then(() => undefined)
  }

  static listForApi (options: {
    pluginType?: PluginType_Type
    uninstalled?: boolean
    start: number
    count: number
    sort: string
  }) {
    const { uninstalled = false } = options
    const query: FindAndCountOptions = {
      offset: options.start,
      limit: options.count,
      order: getSort(options.sort),
      where: {
        uninstalled
      }
    }

    if (options.pluginType) query.where['type'] = options.pluginType

    return Promise.all([
      PluginModel.count(query),
      PluginModel.findAll<MPlugin>(query)
    ]).then(([ total, data ]) => ({ total, data }))
  }

  static listInstalled (): Promise<MPlugin[]> {
    const query = {
      where: {
        uninstalled: false
      }
    }

    return PluginModel.findAll(query)
  }

  static normalizePluginName (npmName: string) {
    return npmName.replace(/^peertube-((theme)|(plugin))-/, '')
  }

  static getTypeFromNpmName (npmName: string) {
    return npmName.startsWith('peertube-plugin-')
      ? PluginType.PLUGIN
      : PluginType.THEME
  }

  static buildNpmName (name: string, type: PluginType_Type) {
    if (type === PluginType.THEME) return 'peertube-theme-' + name

    return 'peertube-plugin-' + name
  }

  getPublicSettings (registeredSettings: RegisterServerSettingOptions[]) {
    const result: SettingEntries = {}
    const settings = this.settings || {}

    for (const r of registeredSettings) {
      if (r.private !== false) continue

      result[r.name] = settings[r.name] ?? r.default ?? null
    }

    return result
  }

  toFormattedJSON (this: MPluginFormattable): PeerTubePlugin {
    return {
      name: this.name,
      type: this.type,
      version: this.version,
      latestVersion: this.latestVersion,
      enabled: this.enabled,
      uninstalled: this.uninstalled,
      peertubeEngine: this.peertubeEngine,
      description: this.description,
      homepage: this.homepage,
      settings: this.settings,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

}
