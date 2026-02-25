import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { VideoChannelSyncModel } from '@server/models/video/video-channel-sync.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { VideoImportModel } from '@server/models/video/video-import.js'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { synchronizeChannel } from '../sync-channel.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const lTags = loggerTagsFactory('schedulers', 'channel-synchronization')

export class VideoChannelSyncLatestScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler
  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.CHANNEL_SYNC_CHECK_INTERVAL

  private constructor () {
    super({ randomRunOnEnable: true })
  }

  protected async internalExecute () {
    if (!CONFIG.IMPORT.VIDEO_CHANNEL_SYNCHRONIZATION.ENABLED) {
      logger.debug('Discard channels synchronization as the feature is disabled', lTags())
      return
    }

    logger.info('Checking channels to synchronize', lTags())

    const channelSyncs = await VideoChannelSyncModel.listSyncs()

    for (const sync of channelSyncs) {
      const channel = await VideoChannelModel.loadAndPopulateAccount(sync.videoChannelId)

      // We can't rely on publication date for playlist elements
      // For example, an old video may have been added to a playlist since the last sync
      let skipPublishedBeforeOrEq: Date

      if (!this.isPlaylistUrl(sync.externalChannelUrl)) {
        const lastImport = await VideoImportModel.loadLastImportBySyncId({ channelSyncId: sync.id })

        if (lastImport && lastImport.Video?.originallyPublishedAt) {
          skipPublishedBeforeOrEq = lastImport.Video.originallyPublishedAt
        } else {
          skipPublishedBeforeOrEq = sync.lastSyncAt || sync.createdAt
        }
      }

      await synchronizeChannel({
        channel,
        externalChannelUrl: sync.externalChannelUrl,
        videosCountLimit: CONFIG.IMPORT.VIDEO_CHANNEL_SYNCHRONIZATION.VIDEOS_LIMIT_PER_SYNCHRONIZATION,
        channelSync: sync,
        skipPublishedBeforeOrEq
      })
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  private isPlaylistUrl (url: string): boolean {
    const parsed = new URL(url)
    const pathname = parsed.pathname.toLowerCase()

    return pathname.startsWith('/playlist/') || // Dailymotion playlist
      pathname.startsWith('/showcase/') || // Vimeo playlist
      pathname === '/playlist' || // YouTube playlist
      pathname.startsWith('/w/p/') // PeerTube playlist
  }
}
