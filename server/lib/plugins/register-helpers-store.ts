import * as express from 'express'
import { logger } from '@server/helpers/logger'
import {
  VIDEO_CATEGORIES,
  VIDEO_LANGUAGES,
  VIDEO_LICENCES,
  VIDEO_PLAYLIST_PRIVACIES,
  VIDEO_PRIVACIES
} from '@server/initializers/constants'
import { onExternalUserAuthenticated } from '@server/lib/auth'
import { PluginModel } from '@server/models/server/plugin'
import {
  RegisterServerAuthExternalOptions,
  RegisterServerAuthExternalResult,
  RegisterServerAuthPassOptions,
  RegisterServerExternalAuthenticatedResult,
  RegisterServerOptions
} from '@server/types/plugins'
import {
  PluginPlaylistPrivacyManager,
  PluginSettingsManager,
  PluginStorageManager,
  PluginVideoCategoryManager,
  PluginVideoLanguageManager,
  PluginVideoLicenceManager,
  PluginVideoPrivacyManager,
  RegisterServerHookOptions,
  RegisterServerSettingOptions
} from '@shared/models'
import { serverHookObject } from '@shared/models/plugins/server-hook.model'
import { buildPluginHelpers } from './plugin-helpers'

type AlterableVideoConstant = 'language' | 'licence' | 'category' | 'privacy' | 'playlistPrivacy'
type VideoConstant = { [key in number | string]: string }

type UpdatedVideoConstant = {
  [name in AlterableVideoConstant]: {
    added: { key: number | string, label: string }[]
    deleted: { key: number | string, label: string }[]
  }
}

export class RegisterHelpersStore {
  private readonly updatedVideoConstants: UpdatedVideoConstant = {
    playlistPrivacy: { added: [], deleted: [] },
    privacy: { added: [], deleted: [] },
    language: { added: [], deleted: [] },
    licence: { added: [], deleted: [] },
    category: { added: [], deleted: [] }
  }

  private readonly settings: RegisterServerSettingOptions[] = []

  private idAndPassAuths: RegisterServerAuthPassOptions[] = []
  private externalAuths: RegisterServerAuthExternalOptions[] = []

  private readonly onSettingsChangeCallbacks: ((settings: any) => void)[] = []

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

    const videoPrivacyManager = this.buildVideoPrivacyManager()
    const playlistPrivacyManager = this.buildPlaylistPrivacyManager()

    const registerIdAndPassAuth = this.buildRegisterIdAndPassAuth()
    const registerExternalAuth = this.buildRegisterExternalAuth()
    const unregisterIdAndPassAuth = this.buildUnregisterIdAndPassAuth()
    const unregisterExternalAuth = this.buildUnregisterExternalAuth()

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

      videoPrivacyManager,
      playlistPrivacyManager,

      registerIdAndPassAuth,
      registerExternalAuth,
      unregisterIdAndPassAuth,
      unregisterExternalAuth,

      peertubeHelpers
    }
  }

  reinitVideoConstants (npmName: string) {
    const hash = {
      language: VIDEO_LANGUAGES,
      licence: VIDEO_LICENCES,
      category: VIDEO_CATEGORIES,
      privacy: VIDEO_PRIVACIES,
      playlistPrivacy: VIDEO_PLAYLIST_PRIVACIES
    }
    const types: AlterableVideoConstant[] = [ 'language', 'licence', 'category', 'privacy', 'playlistPrivacy' ]

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

  getIdAndPassAuths () {
    return this.idAndPassAuths
  }

  getExternalAuths () {
    return this.externalAuths
  }

  getOnSettingsChangedCallbacks () {
    return this.onSettingsChangeCallbacks
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

  private buildRegisterIdAndPassAuth () {
    return (options: RegisterServerAuthPassOptions) => {
      if (!options.authName || typeof options.getWeight !== 'function' || typeof options.login !== 'function') {
        logger.error('Cannot register auth plugin %s: authName, getWeight or login are not valid.', this.npmName, { options })
        return
      }

      this.idAndPassAuths.push(options)
    }
  }

  private buildRegisterExternalAuth () {
    const self = this

    return (options: RegisterServerAuthExternalOptions) => {
      if (!options.authName || typeof options.authDisplayName !== 'function' || typeof options.onAuthRequest !== 'function') {
        logger.error('Cannot register auth plugin %s: authName, authDisplayName or onAuthRequest are not valid.', this.npmName, { options })
        return
      }

      this.externalAuths.push(options)

      return {
        userAuthenticated (result: RegisterServerExternalAuthenticatedResult): void {
          onExternalUserAuthenticated({
            npmName: self.npmName,
            authName: options.authName,
            authResult: result
          }).catch(err => {
            logger.error('Cannot execute onExternalUserAuthenticated.', { npmName: self.npmName, authName: options.authName, err })
          })
        }
      } as RegisterServerAuthExternalResult
    }
  }

  private buildUnregisterExternalAuth () {
    return (authName: string) => {
      this.externalAuths = this.externalAuths.filter(a => a.authName !== authName)
    }
  }

  private buildUnregisterIdAndPassAuth () {
    return (authName: string) => {
      this.idAndPassAuths = this.idAndPassAuths.filter(a => a.authName !== authName)
    }
  }

  private buildSettingsManager (): PluginSettingsManager {
    return {
      getSetting: (name: string) => PluginModel.getSetting(this.plugin.name, this.plugin.type, name, this.settings),

      getSettings: (names: string[]) => PluginModel.getSettings(this.plugin.name, this.plugin.type, names, this.settings),

      setSetting: (name: string, value: string) => PluginModel.setSetting(this.plugin.name, this.plugin.type, name, value),

      onSettingsChange: (cb: (settings: any) => void) => this.onSettingsChangeCallbacks.push(cb)
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

  private buildVideoPrivacyManager (): PluginVideoPrivacyManager {
    return {
      deletePrivacy: (key: number) => {
        return this.deleteConstant({ npmName: this.npmName, type: 'privacy', obj: VIDEO_PRIVACIES, key })
      }
    }
  }

  private buildPlaylistPrivacyManager (): PluginPlaylistPrivacyManager {
    return {
      deletePlaylistPrivacy: (key: number) => {
        return this.deleteConstant({ npmName: this.npmName, type: 'playlistPrivacy', obj: VIDEO_PLAYLIST_PRIVACIES, key })
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
