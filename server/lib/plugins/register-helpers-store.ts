import { PluginSettingsManager } from '@shared/models/plugins/plugin-settings-manager.model'
import { PluginModel } from '@server/models/server/plugin'
import { PluginStorageManager } from '@shared/models/plugins/plugin-storage-manager.model'
import { PluginVideoLanguageManager } from '@shared/models/plugins/plugin-video-language-manager.model'
import { VIDEO_CATEGORIES, VIDEO_LANGUAGES, VIDEO_LICENCES } from '@server/initializers/constants'
import { PluginVideoLicenceManager } from '@shared/models/plugins/plugin-video-licence-manager.model'
import { PluginVideoCategoryManager } from '@shared/models/plugins/plugin-video-category-manager.model'
import { RegisterServerOptions } from '@server/typings/plugins'
import { buildPluginHelpers } from './plugin-helpers'
import { logger } from '@server/helpers/logger'
import { RegisterServerHookOptions } from '@shared/models/plugins/register-server-hook.model'
import { serverHookObject } from '@shared/models/plugins/server-hook.model'
import { RegisterServerSettingOptions } from '@shared/models/plugins/register-server-setting.model'
import * as express from 'express'

type AlterableVideoConstant = 'language' | 'licence' | 'category'
type VideoConstant = { [key in number | string]: string }

type UpdatedVideoConstant = {
  [name in AlterableVideoConstant]: {
    added: { key: number | string, label: string }[]
    deleted: { key: number | string, label: string }[]
  }
}

export class RegisterHelpersStore {
  private readonly updatedVideoConstants: UpdatedVideoConstant = {
    language: { added: [], deleted: [] },
    licence: { added: [], deleted: [] },
    category: { added: [], deleted: [] }
  }

  private readonly settings: RegisterServerSettingOptions[] = []

  private readonly router: express.Router

  constructor (
    private readonly npmName: string,
    private readonly plugin: PluginModel,
    private readonly onHookAdded: (options: RegisterServerHookOptions) => void
  ) {
    this.router = express.Router()
  }

  buildRegisterHelpers (): RegisterServerOptions {
    const registerHook = this.buildRegisterHook()
    const registerSetting = this.buildRegisterSetting()

    const getRouter = this.buildGetRouter()

    const settingsManager = this.buildSettingsManager()
    const storageManager = this.buildStorageManager()

    const videoLanguageManager = this.buildVideoLanguageManager()

    const videoLicenceManager = this.buildVideoLicenceManager()
    const videoCategoryManager = this.buildVideoCategoryManager()

    const peertubeHelpers = buildPluginHelpers(this.npmName)

    return {
      registerHook,
      registerSetting,

      getRouter,

      settingsManager,
      storageManager,

      videoLanguageManager,
      videoCategoryManager,
      videoLicenceManager,

      peertubeHelpers
    }
  }

  reinitVideoConstants (npmName: string) {
    const hash = {
      language: VIDEO_LANGUAGES,
      licence: VIDEO_LICENCES,
      category: VIDEO_CATEGORIES
    }
    const types: AlterableVideoConstant[] = [ 'language', 'licence', 'category' ]

    for (const type of types) {
      const updatedConstants = this.updatedVideoConstants[type][npmName]
      if (!updatedConstants) continue

      for (const added of updatedConstants.added) {
        delete hash[type][added.key]
      }

      for (const deleted of updatedConstants.deleted) {
        hash[type][deleted.key] = deleted.label
      }

      delete this.updatedVideoConstants[type][npmName]
    }
  }

  getSettings () {
    return this.settings
  }

  getRouter () {
    return this.router
  }

  private buildGetRouter () {
    return () => this.router
  }

  private buildRegisterSetting () {
    return (options: RegisterServerSettingOptions) => {
      this.settings.push(options)
    }
  }

  private buildRegisterHook () {
    return (options: RegisterServerHookOptions) => {
      if (serverHookObject[options.target] !== true) {
        logger.warn('Unknown hook %s of plugin %s. Skipping.', options.target, this.npmName)
        return
      }

      return this.onHookAdded(options)
    }
  }

  private buildSettingsManager (): PluginSettingsManager {
    return {
      getSetting: (name: string) => PluginModel.getSetting(this.plugin.name, this.plugin.type, name),

      setSetting: (name: string, value: string) => PluginModel.setSetting(this.plugin.name, this.plugin.type, name, value)
    }
  }

  private buildStorageManager (): PluginStorageManager {
    return {
      getData: (key: string) => PluginModel.getData(this.plugin.name, this.plugin.type, key),

      storeData: (key: string, data: any) => PluginModel.storeData(this.plugin.name, this.plugin.type, key, data)
    }
  }

  private buildVideoLanguageManager (): PluginVideoLanguageManager {
    return {
      addLanguage: (key: string, label: string) => {
        return this.addConstant({ npmName: this.npmName, type: 'language', obj: VIDEO_LANGUAGES, key, label })
      },

      deleteLanguage: (key: string) => {
        return this.deleteConstant({ npmName: this.npmName, type: 'language', obj: VIDEO_LANGUAGES, key })
      }
    }
  }

  private buildVideoCategoryManager (): PluginVideoCategoryManager {
    return {
      addCategory: (key: number, label: string) => {
        return this.addConstant({ npmName: this.npmName, type: 'category', obj: VIDEO_CATEGORIES, key, label })
      },

      deleteCategory: (key: number) => {
        return this.deleteConstant({ npmName: this.npmName, type: 'category', obj: VIDEO_CATEGORIES, key })
      }
    }
  }

  private buildVideoLicenceManager (): PluginVideoLicenceManager {
    return {
      addLicence: (key: number, label: string) => {
        return this.addConstant({ npmName: this.npmName, type: 'licence', obj: VIDEO_LICENCES, key, label })
      },

      deleteLicence: (key: number) => {
        return this.deleteConstant({ npmName: this.npmName, type: 'licence', obj: VIDEO_LICENCES, key })
      }
    }
  }

  private addConstant<T extends string | number> (parameters: {
    npmName: string
    type: AlterableVideoConstant
    obj: VideoConstant
    key: T
    label: string
  }) {
    const { npmName, type, obj, key, label } = parameters

    if (obj[key]) {
      logger.warn('Cannot add %s %s by plugin %s: key already exists.', type, npmName, key)
      return false
    }

    if (!this.updatedVideoConstants[type][npmName]) {
      this.updatedVideoConstants[type][npmName] = {
        added: [],
        deleted: []
      }
    }

    this.updatedVideoConstants[type][npmName].added.push({ key, label })
    obj[key] = label

    return true
  }

  private deleteConstant<T extends string | number> (parameters: {
    npmName: string
    type: AlterableVideoConstant
    obj: VideoConstant
    key: T
  }) {
    const { npmName, type, obj, key } = parameters

    if (!obj[key]) {
      logger.warn('Cannot delete %s %s by plugin %s: key does not exist.', type, npmName, key)
      return false
    }

    if (!this.updatedVideoConstants[type][npmName]) {
      this.updatedVideoConstants[type][npmName] = {
        added: [],
        deleted: []
      }
    }

    this.updatedVideoConstants[type][npmName].deleted.push({ key, label: obj[key] })
    delete obj[key]

    return true
  }
}
