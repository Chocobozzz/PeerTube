import * as Bluebird from 'bluebird'
import { Router } from 'express'
import { Logger } from 'winston'
import { ActorModel } from '@server/models/activitypub/actor'
import { VideoBlacklistCreate } from '@shared/models'
import { PluginPlaylistPrivacyManager } from '@shared/models/plugins/plugin-playlist-privacy-manager.model'
import { PluginVideoPrivacyManager } from '@shared/models/plugins/plugin-video-privacy-manager.model'
import {
  RegisterServerAuthExternalOptions,
  RegisterServerAuthExternalResult,
  RegisterServerAuthPassOptions
} from '@shared/models/plugins/register-server-auth.model'
import { PluginSettingsManager } from '../../../shared/models/plugins/plugin-settings-manager.model'
import { PluginStorageManager } from '../../../shared/models/plugins/plugin-storage-manager.model'
import { PluginVideoCategoryManager } from '../../../shared/models/plugins/plugin-video-category-manager.model'
import { PluginVideoLanguageManager } from '../../../shared/models/plugins/plugin-video-language-manager.model'
import { PluginVideoLicenceManager } from '../../../shared/models/plugins/plugin-video-licence-manager.model'
import { RegisterServerHookOptions } from '../../../shared/models/plugins/register-server-hook.model'
import { RegisterServerSettingOptions } from '../../../shared/models/plugins/register-server-setting.model'
import { MVideoThumbnail } from '../models'

export type PeerTubeHelpers = {
  logger: Logger

  database: {
    query: Function
  }

  videos: {
    loadByUrl: (url: string) => Bluebird<MVideoThumbnail>

    removeVideo: (videoId: number) => Promise<void>
  }

  config: {
    getWebserverUrl: () => string
  }

  moderation: {
    blockServer: (options: { byAccountId: number, hostToBlock: string }) => Promise<void>
    unblockServer: (options: { byAccountId: number, hostToUnblock: string }) => Promise<void>
    blockAccount: (options: { byAccountId: number, handleToBlock: string }) => Promise<void>
    unblockAccount: (options: { byAccountId: number, handleToUnblock: string }) => Promise<void>

    blacklistVideo: (options: { videoIdOrUUID: number | string, createOptions: VideoBlacklistCreate }) => Promise<void>
    unblacklistVideo: (options: { videoIdOrUUID: number | string }) => Promise<void>
  }

  server: {
    getServerActor: () => Promise<ActorModel>
  }
}

export type RegisterServerOptions = {
  registerHook: (options: RegisterServerHookOptions) => void

  registerSetting: (options: RegisterServerSettingOptions) => void

  settingsManager: PluginSettingsManager

  storageManager: PluginStorageManager

  videoCategoryManager: PluginVideoCategoryManager
  videoLanguageManager: PluginVideoLanguageManager
  videoLicenceManager: PluginVideoLicenceManager

  videoPrivacyManager: PluginVideoPrivacyManager
  playlistPrivacyManager: PluginPlaylistPrivacyManager

  registerIdAndPassAuth: (options: RegisterServerAuthPassOptions) => void
  registerExternalAuth: (options: RegisterServerAuthExternalOptions) => RegisterServerAuthExternalResult
  unregisterIdAndPassAuth: (authName: string) => void
  unregisterExternalAuth: (authName: string) => void

  // Get plugin router to create custom routes
  // Base routes of this router are
  //  * /plugins/:pluginName/:pluginVersion/router/...
  //  * /plugins/:pluginName/router/...
  getRouter(): Router

  peertubeHelpers: PeerTubeHelpers
}
