import express from 'express'
import { Server } from 'http'
import {
  EncoderOptionsBuilder,
  PluginSettingsManager,
  PluginStorageManager,
  RegisterServerHookOptions,
  RegisterServerSettingOptions,
  serverHookObject,
  SettingsChangeCallback,
  VideoPlaylistPrivacyType,
  VideoPrivacyType
} from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { onExternalUserAuthenticated } from '@server/lib/auth/external-auth.js'
import { VideoConstantManagerFactory } from '@server/lib/plugins/video-constant-manager-factory.js'
import { PluginModel } from '@server/models/server/plugin.js'
import {
  RegisterServerAuthExternalOptions,
  RegisterServerAuthExternalResult,
  RegisterServerAuthPassOptions,
  RegisterServerExternalAuthenticatedResult,
  RegisterServerOptions,
  RegisterServerWebSocketRouteOptions
} from '@server/types/plugins/index.js'
import { VideoTranscodingProfilesManager } from '../transcoding/default-transcoding-profiles.js'
import { buildPluginHelpers } from './plugin-helpers-builder.js'

export class RegisterHelpers {
  private readonly transcodingProfiles: {
    [ npmName: string ]: {
      type: 'vod' | 'live'
      encoder: string
      profile: string
    }[]
  } = {}

  private readonly transcodingEncoders: {
    [ npmName: string ]: {
      type: 'vod' | 'live'
      streamType: 'audio' | 'video'
      encoder: string
      priority: number
    }[]
  } = {}

  private settings: RegisterServerSettingOptions[] = []

  private idAndPassAuths: RegisterServerAuthPassOptions[] = []
  private externalAuths: RegisterServerAuthExternalOptions[] = []

  private readonly onSettingsChangeCallbacks: SettingsChangeCallback[] = []

  private readonly webSocketRoutes: RegisterServerWebSocketRouteOptions[] = []

  private readonly router: express.Router
  private readonly videoConstantManagerFactory: VideoConstantManagerFactory

  constructor (
    private readonly npmName: string,
    private readonly plugin: PluginModel,
    private readonly server: Server,
    private readonly onHookAdded: (options: RegisterServerHookOptions) => void
  ) {
    this.router = express.Router()
    this.videoConstantManagerFactory = new VideoConstantManagerFactory(this.npmName)
  }

  buildRegisterHelpers (): RegisterServerOptions {
    const registerHook = this.buildRegisterHook()
    const registerSetting = this.buildRegisterSetting()

    const getRouter = this.buildGetRouter()
    const registerWebSocketRoute = this.buildRegisterWebSocketRoute()

    const settingsManager = this.buildSettingsManager()
    const storageManager = this.buildStorageManager()

    const videoLanguageManager = this.videoConstantManagerFactory.createVideoConstantManager<string>('language')

    const videoLicenceManager = this.videoConstantManagerFactory.createVideoConstantManager<number>('licence')
    const videoCategoryManager = this.videoConstantManagerFactory.createVideoConstantManager<number>('category')

    const videoPrivacyManager = this.videoConstantManagerFactory.createVideoConstantManager<VideoPrivacyType>('privacy')
    const playlistPrivacyManager = this.videoConstantManagerFactory.createVideoConstantManager<VideoPlaylistPrivacyType>('playlistPrivacy')

    const transcodingManager = this.buildTranscodingManager()

    const registerIdAndPassAuth = this.buildRegisterIdAndPassAuth()
    const registerExternalAuth = this.buildRegisterExternalAuth()
    const unregisterIdAndPassAuth = this.buildUnregisterIdAndPassAuth()
    const unregisterExternalAuth = this.buildUnregisterExternalAuth()

    const peertubeHelpers = buildPluginHelpers(this.server, this.plugin, this.npmName)

    return {
      registerHook,
      registerSetting,

      getRouter,
      registerWebSocketRoute,

      settingsManager,
      storageManager,

      videoLanguageManager: {
        ...videoLanguageManager,
        /** @deprecated use `addConstant` instead **/
        addLanguage: videoLanguageManager.addConstant,
        /** @deprecated use `deleteConstant` instead **/
        deleteLanguage: videoLanguageManager.deleteConstant
      },
      videoCategoryManager: {
        ...videoCategoryManager,
        /** @deprecated use `addConstant` instead **/
        addCategory: videoCategoryManager.addConstant,
        /** @deprecated use `deleteConstant` instead **/
        deleteCategory: videoCategoryManager.deleteConstant
      },
      videoLicenceManager: {
        ...videoLicenceManager,
        /** @deprecated use `addConstant` instead **/
        addLicence: videoLicenceManager.addConstant,
        /** @deprecated use `deleteConstant` instead **/
        deleteLicence: videoLicenceManager.deleteConstant
      },

      videoPrivacyManager: {
        ...videoPrivacyManager,
        /** @deprecated use `deleteConstant` instead **/
        deletePrivacy: videoPrivacyManager.deleteConstant
      },
      playlistPrivacyManager: {
        ...playlistPrivacyManager,
        /** @deprecated use `deleteConstant` instead **/
        deletePlaylistPrivacy: playlistPrivacyManager.deleteConstant
      },

      transcodingManager,

      registerIdAndPassAuth,
      registerExternalAuth,
      unregisterIdAndPassAuth,
      unregisterExternalAuth,

      peertubeHelpers
    }
  }

  reinitVideoConstants (npmName: string) {
    this.videoConstantManagerFactory.resetVideoConstants(npmName)
  }

  reinitTranscodingProfilesAndEncoders (npmName: string) {
    const profiles = this.transcodingProfiles[npmName]
    if (Array.isArray(profiles)) {
      for (const profile of profiles) {
        VideoTranscodingProfilesManager.Instance.removeProfile(profile)
      }
    }

    const encoders = this.transcodingEncoders[npmName]
    if (Array.isArray(encoders)) {
      for (const o of encoders) {
        VideoTranscodingProfilesManager.Instance.removeEncoderPriority(o.type, o.streamType, o.encoder, o.priority)
      }
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

  getWebSocketRoutes () {
    return this.webSocketRoutes
  }

  private buildGetRouter () {
    return () => this.router
  }

  private buildRegisterWebSocketRoute () {
    return (options: RegisterServerWebSocketRouteOptions) => {
      this.webSocketRoutes.push(options)
    }
  }

  private buildRegisterSetting () {
    return (options: RegisterServerSettingOptions) => {
      this.settings = [
        ...this.settings.filter((s) => s.name !== options.name),
        options
      ]
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

      onSettingsChange: (cb: SettingsChangeCallback) => this.onSettingsChangeCallbacks.push(cb)
    }
  }

  private buildStorageManager (): PluginStorageManager {
    return {
      getData: (key: string) => PluginModel.getData(this.plugin.name, this.plugin.type, key),

      storeData: (key: string, data: any) => PluginModel.storeData(this.plugin.name, this.plugin.type, key, data)
    }
  }

  private buildTranscodingManager () {
    const self = this

    function addProfile (type: 'live' | 'vod', encoder: string, profile: string, builder: EncoderOptionsBuilder) {
      if (profile === 'default') {
        logger.error('A plugin cannot add a default live transcoding profile')
        return false
      }

      VideoTranscodingProfilesManager.Instance.addProfile({
        type,
        encoder,
        profile,
        builder
      })

      if (!self.transcodingProfiles[self.npmName]) self.transcodingProfiles[self.npmName] = []
      self.transcodingProfiles[self.npmName].push({ type, encoder, profile })

      return true
    }

    function addEncoderPriority (type: 'live' | 'vod', streamType: 'audio' | 'video', encoder: string, priority: number) {
      VideoTranscodingProfilesManager.Instance.addEncoderPriority(type, streamType, encoder, priority)

      if (!self.transcodingEncoders[self.npmName]) self.transcodingEncoders[self.npmName] = []
      self.transcodingEncoders[self.npmName].push({ type, streamType, encoder, priority })
    }

    return {
      addLiveProfile (encoder: string, profile: string, builder: EncoderOptionsBuilder) {
        return addProfile('live', encoder, profile, builder)
      },

      addVODProfile (encoder: string, profile: string, builder: EncoderOptionsBuilder) {
        return addProfile('vod', encoder, profile, builder)
      },

      addLiveEncoderPriority (streamType: 'audio' | 'video', encoder: string, priority: number) {
        return addEncoderPriority('live', streamType, encoder, priority)
      },

      addVODEncoderPriority (streamType: 'audio' | 'video', encoder: string, priority: number) {
        return addEncoderPriority('vod', streamType, encoder, priority)
      },

      removeAllProfilesAndEncoderPriorities () {
        return self.reinitTranscodingProfilesAndEncoders(self.npmName)
      }
    }
  }
}
