import {
  auditLog,
  buildAccountBlockAuditEntity,
  buildServerBlockAuditEntity,
  buildVideoAuditEntity,
  buildVideoBlockAuditEntity,
  getAuditPluginActor
} from '@server/lib/audit-log/index.js'
import { ffprobePromise } from '@peertube/peertube-ffmpeg'
import { FileStorage, VideoBlacklistCreate } from '@peertube/peertube-models'
import { Awaitable } from '@peertube/peertube-typescript-utils'
import { toCompleteUUID } from '@server/helpers/custom-validators/misc.js'
import { retryTransactionWrapper, runTransaction } from '@server/helpers/database-utils.js'
import { buildWinstonLogger, createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { AccountModel } from '@server/models/account/account.js'
import { getServerAccount, getServerActor } from '@server/models/application/application.js'
import { CommentAutomaticTagModel } from '@server/models/automatic-tag/comment-automatic-tag.js'
import { VideoAutomaticTagModel } from '@server/models/automatic-tag/video-automatic-tag.js'
import { AccountBlocklistModel } from '@server/models/blocklist/account-blocklist.js'
import { ServerBlocklistModel } from '@server/models/blocklist/server-blocklist.js'
import { ServerModel } from '@server/models/server/server.js'
import { UserModel } from '@server/models/user/user.js'
import { VideoBlacklistModel } from '@server/models/video/video-blacklist.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { VideoModel } from '@server/models/video/video.js'
import { MPlugin, MVideo, UserNotificationModelForApi } from '@server/types/models/index.js'
import { PeerTubeHelpers } from '@server/types/plugins/index.js'
import express from 'express'
import { Server } from 'http'
import { join } from 'path'
import { addAccountInBlocklist, addServerInBlocklist, removeAccountFromBlocklist, removeServerFromBlocklist } from '../blocklist.js'
import { JobQueue } from '../job-queue/index.js'
import { LocalVideoUpdater } from '../local-video-updater.js'
import { PeerTubeSocket } from '../peertube-socket.js'
import { ServerConfigManager } from '../server-config-manager.js'
import { blacklistVideo, unblacklistVideo } from '../video-blacklist.js'
import { VideoPathManager } from '../video-path-manager.js'

const logger = createLogger('plugin')

function buildPluginHelpers (httpServer: Server, pluginModel: MPlugin, npmName: string): PeerTubeHelpers {
  return {
    logger: buildPluginLogger(npmName),

    database: buildDatabaseHelpers(),
    videos: buildVideosHelpers(npmName),

    config: buildConfigHelpers(),

    server: buildServerHelpers(httpServer),

    moderation: buildModerationHelpers(npmName),

    plugin: buildPluginRelatedHelpers(pluginModel, npmName),

    socket: buildSocketHelpers(npmName),

    user: buildUserHelpers(npmName),

    automaticTags: buildAutomaticTagsHelpers(),

    email: buildEmailHelpers()
  }
}

export {
  buildPluginHelpers
}

// ---------------------------------------------------------------------------

function buildPluginLogger (npmName: string) {
  return buildWinstonLogger({ labelSuffix: npmName })
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

function buildVideosHelpers (npmName: string) {
  return {
    loadByUrl: (url: string) => {
      return VideoModel.loadByUrl(url)
    },

    loadByIdOrUUID: (id: number | string) => {
      return VideoModel.loadWithThumbnails(toCompleteUUID(id))
    },

    loadByIdOrUUIDWithFiles: (id: number | string) => {
      return VideoModel.loadWithFiles(toCompleteUUID(id))
    },

    removeVideo: (id: number) => {
      return runTransaction(async t => {
        const video = await VideoModel.loadFull(id, t)

        const videoAuditEntity = auditLog.snapshot(() => buildVideoAuditEntity(video.toFormattedDetailsJSON()))
        await video.destroy({ transaction: t })

        auditLog.delete(getAuditPluginActor(npmName), videoAuditEntity, { transaction: t })
      })
    },

    updateVideo: async (options: Parameters<PeerTubeHelpers['videos']['updateVideo']>[0]) => {
      const video = await VideoModel.loadFull(options.videoId)
      if (!video) return

      await logger.withContext([ npmName, video.uuid ], async () => {
        const updater = new LocalVideoUpdater({ video, user: null, auditActor: getAuditPluginActor(npmName) })
        await updater.update(options.attributes)
      })
    },

    ffprobe: (path: string) => {
      return ffprobePromise(path)
    },

    withFile: async <T>(
      options: {
        videoId: number | string
        videoFileId: number
      },
      cb: (path: string) => Awaitable<T>
    ) => {
      const videoFile = await VideoFileModel.loadWithVideoOrPlaylist(options.videoFileId, toCompleteUUID(options.videoId))
      if (!videoFile) throw new Error('Video file not found')

      const video = videoFile.getVideo()

      return logger.withContext([ npmName, video.uuid ], async () => {
        const releaser = await VideoPathManager.Instance.lockFiles(video.uuid)

        try {
          return await VideoPathManager.Instance.makeAvailableVideoFile(videoFile, cb)
        } finally {
          releaser()
        }
      })
    },

    getFiles: async (id: number | string) => {
      const video = await VideoModel.loadFull(id)
      if (!video) return undefined

      const webVideoFiles = (video.VideoFiles || []).map(f => ({
        id: f.id,
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
            id: f.id,
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
        type: t.width > 300
          ? 2 as const // Preview
          : 1 as const, // Thumbnail

        width: t.width,
        height: t.height,
        url: t.getLocalFileUrl(),
        path: t.isLocal() && t.storage === FileStorage.FILE_SYSTEM
          ? t.getFSPath()
          : null
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

function buildModerationHelpers (npmName: string) {
  const auditActor = getAuditPluginActor(npmName)

  return {
    blockServer: async (options: { byAccountId: number, hostToBlock: string }) => {
      const serverToBlock = await ServerModel.loadOrCreateByHost(options.hostToBlock)
      const user = await UserModel.loadByAccountId(options.byAccountId)

      await addServerInBlocklist({
        byAccountId: options.byAccountId,
        targetServer: serverToBlock,
        removeNotificationOfUserId: user?.id
      })

      auditLog.create(auditActor, () => buildServerBlockAuditEntity({ byAccountId: options.byAccountId, targetServer: serverToBlock }))
    },

    unblockServer: async (options: { byAccountId: number, hostToUnblock: string }) => {
      const serverBlock = await ServerBlocklistModel.loadByAccountAndHost(options.byAccountId, options.hostToUnblock)
      if (!serverBlock) return

      await removeServerFromBlocklist(serverBlock)

      auditLog.delete(
        auditActor,
        () =>
          buildServerBlockAuditEntity({
            byAccountId: options.byAccountId,
            targetServer: { id: serverBlock.targetServerId, host: options.hostToUnblock }
          })
      )
    },

    blockAccount: async (options: { byAccountId: number, handleToBlock: string }) => {
      const accountToBlock = await AccountModel.loadByHandle(options.handleToBlock)
      if (!accountToBlock) return

      const user = await UserModel.loadByAccountId(options.byAccountId)

      await addAccountInBlocklist({
        byAccountId: options.byAccountId,
        targetAccount: accountToBlock,
        removeNotificationOfUserId: user?.id
      })

      auditLog.create(
        auditActor,
        () =>
          buildAccountBlockAuditEntity({
            byAccountId: options.byAccountId,
            targetAccount: { id: accountToBlock.id, handle: accountToBlock.Actor.getFullIdentifier() }
          })
      )
    },

    unblockAccount: async (options: { byAccountId: number, handleToUnblock: string }) => {
      const targetAccount = await AccountModel.loadByHandle(options.handleToUnblock)
      if (!targetAccount) return

      const accountBlock = await AccountBlocklistModel.loadByAccountAndTarget(options.byAccountId, targetAccount.id)
      if (!accountBlock) return

      await removeAccountFromBlocklist(accountBlock)

      auditLog.delete(
        auditActor,
        () =>
          buildAccountBlockAuditEntity({
            byAccountId: options.byAccountId,
            targetAccount: { id: targetAccount.id, handle: targetAccount.Actor.getFullIdentifier() }
          })
      )
    },

    blacklistVideo: async (options: { videoIdOrUUID: number | string, createOptions: VideoBlacklistCreate }) => {
      const video = await VideoModel.loadFull(options.videoIdOrUUID)
      if (!video) return

      await logger.withContext([ video.uuid ], async () => {
        const videoBlock = await blacklistVideo(video, options.createOptions)

        auditLog.create(auditActor, () => buildVideoBlockAuditEntity({ video, videoBlock }))
      })
    },

    unblacklistVideo: async (options: { videoIdOrUUID: number | string }) => {
      const video = await VideoModel.loadFull(options.videoIdOrUUID)
      if (!video) return

      const videoBlacklist = await VideoBlacklistModel.loadByVideoId(video.id)
      if (!videoBlacklist) return

      await unblacklistVideo(videoBlacklist, video)

      auditLog.delete(auditActor, () => buildVideoBlockAuditEntity({ video, videoBlock: videoBlacklist }))
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

function buildSocketHelpers (npmName: string) {
  return {
    sendNotification: (userId: number, notification: UserNotificationModelForApi) => {
      if (typeof notification?.toFormattedJSON !== 'function') {
        logger.error(
          'Plugin %s tried to send a notification that is not a user notification model, ignoring it.',
          npmName,
          { userId }
        )

        return
      }

      PeerTubeSocket.Instance.sendNotification(userId, notification)
    },
    sendVideoLiveNewState: (video: MVideo) => {
      PeerTubeSocket.Instance.sendVideoLiveNewState(video)
    }
  }
}

function buildUserHelpers (npmName: string) {
  return {
    loadById: (id: number) => {
      return UserModel.loadByIdFull(id)
    },

    getAuthUser: (res: express.Response) => {
      const user = res.locals.oauth?.token?.User || res.locals.videoFileToken?.user
      if (!user) return undefined

      return UserModel.loadByIdFull(user.id)
    },

    removeUser: async (id: number) => {
      const user = await UserModel.loadByIdFull(id)
      if (!user) return

      if (user.username === 'root') throw new Error('Cannot remove the root user')

      await logger.withContext([ npmName, user.username ], async () => {
        await retryTransactionWrapper(() => {
          return runTransaction(t => user.destroy({ transaction: t }))
        })

        logger.info(`Removed user ${user.username} by plugin ${npmName}.`)
      })
    }
  }
}

function buildAutomaticTagsHelpers () {
  return {
    getServerCommentAutomaticTags: async (options: {
      commentId: number
    }) => {
      const result = await CommentAutomaticTagModel.listByAccountIdsAndCommentId({
        commentId: options.commentId,
        accountIds: [ (await getServerAccount()).id ]
      })

      return result.map(r => r.AutomaticTag)
    },

    getAccountCommentAutomaticTags: async (options: {
      accountId: number
      commentId: number
    }) => {
      const result = await CommentAutomaticTagModel.listByAccountIdsAndCommentId({
        commentId: options.commentId,
        accountIds: [ options.accountId ]
      })

      return result.map(r => r.AutomaticTag)
    },

    getServerVideoAutomaticTags: async (options: { videoId: number }) => {
      const result = await VideoAutomaticTagModel.listByAccountIdsAndVideoId({
        videoId: options.videoId,
        accountIds: [ (await getServerAccount()).id ]
      })

      return result.map(r => r.AutomaticTag)
    }
  }
}

function buildEmailHelpers () {
  return {
    createJob: async (payload: Parameters<PeerTubeHelpers['email']['createJob']>[0]) => {
      await JobQueue.Instance.createJob({
        type: 'email',
        payload: {
          to: { email: payload.to.email, language: payload.to.language || CONFIG.INSTANCE.DEFAULT_LANGUAGE },

          text: payload.text,

          subject: payload.subject,
          title: payload.title,

          action: payload.action
        }
      })
    }
  }
}
