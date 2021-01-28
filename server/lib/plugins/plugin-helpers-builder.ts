import { PeerTubeHelpers } from '@server/types/plugins'
import { sequelizeTypescript } from '@server/initializers/database'
import { buildLogger } from '@server/helpers/logger'
import { VideoModel } from '@server/models/video/video'
import { WEBSERVER } from '@server/initializers/constants'
import { ServerModel } from '@server/models/server/server'
import { getServerActor } from '@server/models/application/application'
import { addServerInBlocklist, removeServerFromBlocklist, addAccountInBlocklist, removeAccountFromBlocklist } from '../blocklist'
import { ServerBlocklistModel } from '@server/models/server/server-blocklist'
import { AccountModel } from '@server/models/account/account'
import { VideoBlacklistCreate } from '@shared/models'
import { blacklistVideo, unblacklistVideo } from '../video-blacklist'
import { VideoBlacklistModel } from '@server/models/video/video-blacklist'
import { AccountBlocklistModel } from '@server/models/account/account-blocklist'

function buildPluginHelpers (npmName: string): PeerTubeHelpers {
  const logger = buildPluginLogger(npmName)

  const database = buildDatabaseHelpers()
  const videos = buildVideosHelpers()

  const config = buildConfigHelpers()

  const server = buildServerHelpers()

  const moderation = buildModerationHelpers()

  return {
    logger,
    database,
    videos,
    config,
    moderation,
    server
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

function buildServerHelpers () {
  return {
    getServerActor: () => getServerActor()
  }
}

function buildVideosHelpers () {
  return {
    loadByUrl: (url: string) => {
      return VideoModel.loadByUrl(url)
    },

    removeVideo: (id: number) => {
      return sequelizeTypescript.transaction(async t => {
        const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(id, t)

        await video.destroy({ transaction: t })
      })
    }
  }
}

function buildModerationHelpers () {
  return {
    blockServer: async (options: { byAccountId: number, hostToBlock: string }) => {
      const serverToBlock = await ServerModel.loadOrCreateByHost(options.hostToBlock)

      await addServerInBlocklist(options.byAccountId, serverToBlock.id)
    },

    unblockServer: async (options: { byAccountId: number, hostToUnblock: string }) => {
      const serverBlock = await ServerBlocklistModel.loadByAccountAndHost(options.byAccountId, options.hostToUnblock)
      if (!serverBlock) return

      await removeServerFromBlocklist(serverBlock)
    },

    blockAccount: async (options: { byAccountId: number, handleToBlock: string }) => {
      const accountToBlock = await AccountModel.loadByNameWithHost(options.handleToBlock)
      if (!accountToBlock) return

      await addAccountInBlocklist(options.byAccountId, accountToBlock.id)
    },

    unblockAccount: async (options: { byAccountId: number, handleToUnblock: string }) => {
      const targetAccount = await AccountModel.loadByNameWithHost(options.handleToUnblock)
      if (!targetAccount) return

      const accountBlock = await AccountBlocklistModel.loadByAccountAndTarget(options.byAccountId, targetAccount.id)
      if (!accountBlock) return

      await removeAccountFromBlocklist(accountBlock)
    },

    blacklistVideo: async (options: { videoIdOrUUID: number | string, createOptions: VideoBlacklistCreate }) => {
      const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(options.videoIdOrUUID)
      if (!video) return

      await blacklistVideo(video, options.createOptions)
    },

    unblacklistVideo: async (options: { videoIdOrUUID: number | string }) => {
      const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(options.videoIdOrUUID)
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
    }
  }
}
