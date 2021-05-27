import { Response, Router } from 'express'
import { Logger } from 'winston'
import { ActorModel } from '@server/models/actor/actor'
import {
  PluginPlaylistPrivacyManager,
  PluginSettingsManager,
  PluginStorageManager,
  PluginTranscodingManager,
  PluginVideoCategoryManager,
  PluginVideoLanguageManager,
  PluginVideoLicenceManager,
  PluginVideoPrivacyManager,
  RegisterServerHookOptions,
  RegisterServerSettingOptions,
  ServerConfig,
  UserRole,
  VideoBlacklistCreate
} from '@shared/models'
import { MVideoThumbnail } from '../models'
import {
  RegisterServerAuthExternalOptions,
  RegisterServerAuthExternalResult,
  RegisterServerAuthPassOptions
} from './register-server-auth.model'

export type PeerTubeHelpers = {
  logger: Logger

  database: {
    query: Function
  }

  videos: {
    loadByUrl: (url: string) => Promise<MVideoThumbnail>
    loadByIdOrUUID: (id: number | string) => Promise<MVideoThumbnail>

    removeVideo: (videoId: number) => Promise<void>
  }

  config: {
    getWebserverUrl: () => string

    getServerConfig: () => Promise<ServerConfig>
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

  plugin: {
    // PeerTube >= 3.2
    getBaseStaticRoute: () => string

    // PeerTube >= 3.2
    getBaseRouterRoute: () => string

    // PeerTube >= 3.2
    getDataDirectoryPath: () => string
  }

  user: {
    // PeerTube >= 3.2
    getAuthUser: (response: Response) => Promise<{
      id?: string
      username: string
      email: string
      blocked: boolean
      role: UserRole
    } | undefined>
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

  transcodingManager: PluginTranscodingManager

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
