import { Response, Router } from 'express'
import { Server } from 'http'
import { Logger } from 'winston'
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
  ThumbnailType_Type,
  VideoBlacklistCreate
} from '@peertube/peertube-models'
import { ActorModel } from '@server/models/actor/actor.js'
import { MUserDefault, MVideo, MVideoThumbnail, MVideoWithAllFiles, UserNotificationModelForApi } from '../models/index.js'
import {
  RegisterServerAuthExternalOptions,
  RegisterServerAuthExternalResult,
  RegisterServerAuthPassOptions
} from './register-server-auth.model.js'
import { RegisterServerWebSocketRouteOptions } from './register-server-websocket-route.model.js'

export type PeerTubeHelpers = {
  logger: Logger

  database: {
    query: Function
  }

  videos: {
    loadByUrl: (url: string) => Promise<MVideoThumbnail>
    loadByIdOrUUIDWithFiles: (id: number | string) => Promise<MVideoWithAllFiles>
    loadByIdOrUUID: (id: number | string) => Promise<MVideoThumbnail>

    removeVideo: (videoId: number) => Promise<void>

    ffprobe: (path: string) => Promise<any>

    getFiles: (id: number | string) => Promise<{
      webVideo: {
        videoFiles: {
          path: string // Could be null if using remote storage
          url: string
          resolution: number
          size: number
          fps: number
        }[]
      }

      hls: {
        videoFiles: {
          path: string // Could be null if using remote storage
          url: string
          resolution: number
          size: number
          fps: number
        }[]
      }

      thumbnails: {
        type: ThumbnailType_Type
        path: string
      }[]
    }>
  }

  config: {
    getWebserverUrl: () => string

    // PeerTube >= 5.1
    getServerListeningConfig: () => { hostname: string, port: number }

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
    // PeerTube >= 5.0
    getHTTPServer: () => Server

    getServerActor: () => Promise<ActorModel>
  }

  socket: {
    sendNotification: (userId: number, notification: UserNotificationModelForApi) => void
    sendVideoLiveNewState: (video: MVideo) => void
  }

  plugin: {
    // PeerTube >= 3.2
    getBaseStaticRoute: () => string

    // PeerTube >= 3.2
    getBaseRouterRoute: () => string
    // PeerTube >= 5.0
    getBaseWebSocketRoute: () => string

    // PeerTube >= 3.2
    getDataDirectoryPath: () => string
  }

  user: {
    // PeerTube >= 3.2
    getAuthUser: (response: Response) => Promise<MUserDefault>

    // PeerTube >= 4.3
    loadById: (id: number) => Promise<MUserDefault>
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

  // PeerTube >= 5.0
  // Register WebSocket route
  // Base routes of the WebSocket router are
  //  * /plugins/:pluginName/:pluginVersion/ws/...
  //  * /plugins/:pluginName/ws/...
  registerWebSocketRoute: (options: RegisterServerWebSocketRouteOptions) => void

  peertubeHelpers: PeerTubeHelpers
}
