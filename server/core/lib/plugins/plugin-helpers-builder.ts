import express from 'express'
import { Server } from 'http'
import { join } from 'path'
import { buildLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { AccountModel } from '@server/models/account/account.js'
import { AccountBlocklistModel } from '@server/models/account/account-blocklist.js'
import { getServerActor } from '@server/models/application/application.js'
import { ServerModel } from '@server/models/server/server.js'
import { ServerBlocklistModel } from '@server/models/server/server-blocklist.js'
import { UserModel } from '@server/models/user/user.js'
import { VideoModel } from '@server/models/video/video.js'
import { VideoBlacklistModel } from '@server/models/video/video-blacklist.js'
import { MPlugin, MVideo, UserNotificationModelForApi } from '@server/types/models/index.js'
import { PeerTubeHelpers } from '@server/types/plugins/index.js'
import { ffprobePromise } from '@peertube/peertube-ffmpeg'
import { VideoBlacklistCreate, FileStorage } from '@peertube/peertube-models'
import { addAccountInBlocklist, addServerInBlocklist, removeAccountFromBlocklist, removeServerFromBlocklist } from '../blocklist.js'
import { PeerTubeSocket } from '../peertube-socket.js'
import { ServerConfigManager } from '../server-config-manager.js'
import { blacklistVideo, unblacklistVideo } from '../video-blacklist.js'
import { VideoPathManager } from '../video-path-manager.js'

function buildPluginHelpers (httpServer: Server, pluginModel: MPlugin, npmName: string): PeerTubeHelpers {
  const logger = buildPluginLogger(npmName)

  const database = buildDatabaseHelpers()
  const videos = buildVideosHelpers()

  const config = buildConfigHelpers()

  const server = buildServerHelpers(httpServer)

  const moderation = buildModerationHelpers()

  const plugin = buildPluginRelatedHelpers(pluginModel, npmName)

  const socket = buildSocketHelpers()

  const user = buildUserHelpers()

  return {
    logger,
    database,
    videos,
    config,
    moderation,
    plugin,
    server,
    socket,
    user
  }
}

export {
  buildPluginHelpers
}

// ---------------------------------------------------------------------------

function buildPluginLogger (npmName: string) {
  return buildLogger(npmName)
}

function buildDatabaseHelpers () {
  return {
    query: sequelizeTypescript.query.bind(sequelizeTypescript)
  }
}

function buildServerHelpers (httpServer: Server) {
  return {
    getHTTPServer: () => httpServer,

    getServerActor: () => getServerActor()
  }
}

function buildVideosHelpers () {
  return {
    loadByUrl: (url: string) => {
      return VideoModel.loadByUrl(url)
    },

    loadByIdOrUUID: (id: number | string) => {
      return VideoModel.load(id)
    },

    loadByIdOrUUIDWithFiles: (id: number | string) => {
      return VideoModel.loadWithFiles(id)
    },

    removeVideo: (id: number) => {
      return sequelizeTypescript.transaction(async t => {
        const video = await VideoModel.loadFull(id, t)

        await video.destroy({ transaction: t })
      })
    },

    ffprobe: (path: string) => {
      return ffprobePromise(path)
    },

    getFiles: async (id: number | string) => {
      const video = await VideoModel.loadFull(id)
      if (!video) return undefined

      const webVideoFiles = (video.VideoFiles || []).map(f => ({
        path: f.storage === FileStorage.FILE_SYSTEM
          ? VideoPathManager.Instance.getFSVideoFileOutputPath(video, f)
          : null,
        url: f.getFileUrl(video),

        resolution: f.resolution,
        size: f.size,
        fps: f.fps
      }))

      const hls = video.getHLSPlaylist()

      const hlsVideoFiles = hls
        ? (video.getHLSPlaylist().VideoFiles || []).map(f => {
          return {
            path: f.storage === FileStorage.FILE_SYSTEM
              ? VideoPathManager.Instance.getFSVideoFileOutputPath(hls, f)
              : null,
            url: f.getFileUrl(video),
            resolution: f.resolution,
            size: f.size,
            fps: f.fps
          }
        })
        : []

      const thumbnails = video.Thumbnails.map(t => ({
        type: t.type,
        url: t.getOriginFileUrl(video),
        path: t.getPath()
      }))

      return {
        webVideo: {
          videoFiles: webVideoFiles
        },

        hls: {
          videoFiles: hlsVideoFiles
        },

        thumbnails
      }
    }
  }
}

function buildModerationHelpers () {
  return {
    blockServer: async (options: { byAccountId: number, hostToBlock: string }) => {
      const serverToBlock = await ServerModel.loadOrCreateByHost(options.hostToBlock)
      const user = await UserModel.loadByAccountId(options.byAccountId)

      await addServerInBlocklist({
        byAccountId: options.byAccountId,
        targetServerId: serverToBlock.id,
        removeNotificationOfUserId: user?.id
      })
    },

    unblockServer: async (options: { byAccountId: number, hostToUnblock: string }) => {
      const serverBlock = await ServerBlocklistModel.loadByAccountAndHost(options.byAccountId, options.hostToUnblock)
      if (!serverBlock) return

      await removeServerFromBlocklist(serverBlock)
    },

    blockAccount: async (options: { byAccountId: number, handleToBlock: string }) => {
      const accountToBlock = await AccountModel.loadByNameWithHost(options.handleToBlock)
      if (!accountToBlock) return

      const user = await UserModel.loadByAccountId(options.byAccountId)

      await addAccountInBlocklist({
        byAccountId: options.byAccountId,
        targetAccountId: accountToBlock.id,
        removeNotificationOfUserId: user?.id
      })
    },

    unblockAccount: async (options: { byAccountId: number, handleToUnblock: string }) => {
      const targetAccount = await AccountModel.loadByNameWithHost(options.handleToUnblock)
      if (!targetAccount) return

      const accountBlock = await AccountBlocklistModel.loadByAccountAndTarget(options.byAccountId, targetAccount.id)
      if (!accountBlock) return

      await removeAccountFromBlocklist(accountBlock)
    },

    blacklistVideo: async (options: { videoIdOrUUID: number | string, createOptions: VideoBlacklistCreate }) => {
      const video = await VideoModel.loadFull(options.videoIdOrUUID)
      if (!video) return

      await blacklistVideo(video, options.createOptions)
    },

    unblacklistVideo: async (options: { videoIdOrUUID: number | string }) => {
      const video = await VideoModel.loadFull(options.videoIdOrUUID)
      if (!video) return

      const videoBlacklist = await VideoBlacklistModel.loadByVideoId(video.id)
      if (!videoBlacklist) return

      await unblacklistVideo(videoBlacklist, video)
    }
  }
}

function buildConfigHelpers () {
  return {
    getWebserverUrl () {
      return WEBSERVER.URL
    },

    getServerListeningConfig () {
      return { hostname: CONFIG.LISTEN.HOSTNAME, port: CONFIG.LISTEN.PORT }
    },

    getServerConfig () {
      return ServerConfigManager.Instance.getServerConfig()
    }
  }
}

function buildPluginRelatedHelpers (plugin: MPlugin, npmName: string) {
  return {
    getBaseStaticRoute: () => `/plugins/${plugin.name}/${plugin.version}/static/`,

    getBaseRouterRoute: () => `/plugins/${plugin.name}/${plugin.version}/router/`,

    getBaseWebSocketRoute: () => `/plugins/${plugin.name}/${plugin.version}/ws/`,

    getDataDirectoryPath: () => join(CONFIG.STORAGE.PLUGINS_DIR, 'data', npmName)
  }
}

function buildSocketHelpers () {
  return {
    sendNotification: (userId: number, notification: UserNotificationModelForApi) => {
      PeerTubeSocket.Instance.sendNotification(userId, notification)
    },
    sendVideoLiveNewState: (video: MVideo) => {
      PeerTubeSocket.Instance.sendVideoLiveNewState(video)
    }
  }
}

function buildUserHelpers () {
  return {
    loadById: (id: number) => {
      return UserModel.loadByIdFull(id)
    },

    getAuthUser: (res: express.Response) => {
      const user = res.locals.oauth?.token?.User || res.locals.videoFileToken?.user
      if (!user) return undefined

      return UserModel.loadByIdFull(user.id)
    }
  }
}
