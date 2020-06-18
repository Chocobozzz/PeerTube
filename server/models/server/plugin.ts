import * as Bluebird from 'bluebird'
import { FindAndCountOptions, json, QueryTypes } from 'sequelize'
import { AllowNull, Column, CreatedAt, DataType, DefaultScope, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { MPlugin, MPluginFormattable } from '@server/types/models'
import { PeerTubePlugin } from '../../../shared/models/plugins/peertube-plugin.model'
import { PluginType } from '../../../shared/models/plugins/plugin.type'
import { RegisterServerSettingOptions } from '../../../shared/models/plugins/register-server-setting.model'
import {
  isPluginDescriptionValid,
  isPluginHomepage,
  isPluginNameValid,
  isPluginTypeValid,
  isPluginVersionValid
} from '../../helpers/custom-validators/plugins'
import { getSort, throwIfNotValid } from '../utils'

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
export class PluginModel extends Model<PluginModel> {

  @AllowNull(false)
  @Is('PluginName', value => throwIfNotValid(value, isPluginNameValid, 'name'))
  @Column
  name: string

  @AllowNull(false)
  @Is('PluginType', value => throwIfNotValid(value, isPluginTypeValid, 'type'))
  @Column
  type: number

  @AllowNull(false)
  @Is('PluginVersion', value => throwIfNotValid(value, isPluginVersionValid, 'version'))
  @Column
  version: string

  @AllowNull(true)
  @Is('PluginLatestVersion', value => throwIfNotValid(value, isPluginVersionValid, 'version'))
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

  static listEnabledPluginsAndThemes (): Bluebird<MPlugin[]> {
    const query = {
      where: {
        enabled: true,
        uninstalled: false
      }
    }

    return PluginModel.findAll(query)
  }

  static loadByNpmName (npmName: string): Bluebird<MPlugin> {
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

  static getSetting (pluginName: string, pluginType: PluginType, settingName: string, registeredSettings: RegisterServerSettingOptions[]) {
    const query = {
      attributes: [ 'settings' ],
      where: {
        name: pluginName,
        type: pluginType
      }
    }

    return PluginModel.findOne(query)
      .then(p => {
        if (!p || !p.settings || p.settings === undefined) {
          const registered = registeredSettings.find(s => s.name === settingName)
          if (!registered || registered.default === undefined) return undefined

          return registered.default
        }

        return p.settings[settingName]
      })
  }

  static getSettings (
    pluginName: string,
    pluginType: PluginType,
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
        const result: { [settingName: string ]: string | boolean } = {}

        for (const name of settingNames) {
          if (!p || !p.settings || p.settings[name] === undefined) {
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

  static setSetting (pluginName: string, pluginType: PluginType, settingName: string, settingValue: string) {
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

  static getData (pluginName: string, pluginType: PluginType, key: string) {
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

        if (typeof value === 'string' && value.startsWith('{')) {
          try {
            return JSON.parse(value)
          } catch {
            return value
          }
        }

        return c.value
      })
  }

  static storeData (pluginName: string, pluginType: PluginType, key: string, data: any) {
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
    pluginType?: PluginType
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

    return PluginModel
      .findAndCountAll<MPlugin>(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  static listInstalled (): Bluebird<MPlugin[]> {
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

  static buildNpmName (name: string, type: PluginType) {
    if (type === PluginType.THEME) return 'peertube-theme-' + name

    return 'peertube-plugin-' + name
  }

  getPublicSettings (registeredSettings: RegisterServerSettingOptions[]) {
    const result: { [ name: string ]: string } = {}
    const settings = this.settings || {}

    for (const r of registeredSettings) {
      if (r.private !== false) continue

      result[r.name] = settings[r.name] || r.default || null
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
