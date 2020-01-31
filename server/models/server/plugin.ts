import { AllowNull, Column, CreatedAt, DataType, DefaultScope, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { getSort, throwIfNotValid } from '../utils'
import {
  isPluginDescriptionValid,
  isPluginHomepage,
  isPluginNameValid,
  isPluginTypeValid,
  isPluginVersionValid
} from '../../helpers/custom-validators/plugins'
import { PluginType } from '../../../shared/models/plugins/plugin.type'
import { PeerTubePlugin } from '../../../shared/models/plugins/peertube-plugin.model'
import { FindAndCountOptions, json } from 'sequelize'
import { RegisterServerSettingOptions } from '../../../shared/models/plugins/register-server-setting.model'
import * as Bluebird from 'bluebird'
import { MPlugin, MPluginFormattable } from '@server/typings/models'

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

  static getSetting (pluginName: string, pluginType: PluginType, settingName: string) {
    const query = {
      attributes: [ 'settings' ],
      where: {
        name: pluginName,
        type: pluginType
      }
    }

    return PluginModel.findOne(query)
      .then(p => {
        if (!p || !p.settings) return undefined

        return p.settings[settingName]
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
    const query = {
      where: {
        name: pluginName,
        type: pluginType
      }
    }

    const toSave = {
      [`storage.${key}`]: data
    }

    return PluginModel.update(toSave, query)
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
