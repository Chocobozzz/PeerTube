import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { VideoChannelSyncModel } from '@server/models/video/video-channel-sync.js'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { synchronizeChannel } from '../sync-channel.js'
import { AbstractScheduler } from './abstract-scheduler.js'

export class VideoChannelSyncLatestScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler
  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.CHANNEL_SYNC_CHECK_INTERVAL

  private constructor () {
    super()
  }

  protected async internalExecute () {
    if (!CONFIG.IMPORT.VIDEO_CHANNEL_SYNCHRONIZATION.ENABLED) {
      logger.debug('Discard channels synchronization as the feature is disabled')
      return
    }

    logger.info('Checking channels to synchronize')

    const channelSyncs = await VideoChannelSyncModel.listSyncs()

    for (const sync of channelSyncs) {
      const channel = await VideoChannelModel.loadAndPopulateAccount(sync.videoChannelId)

      logger.info(
        'Creating video import jobs for "%s" sync with external channel "%s"',
        channel.Actor.preferredUsername, sync.externalChannelUrl
      )

      const onlyAfter = sync.lastSyncAt || sync.createdAt

      await synchronizeChannel({
        channel,
        externalChannelUrl: sync.externalChannelUrl,
        videosCountLimit: CONFIG.IMPORT.VIDEO_CHANNEL_SYNCHRONIZATION.VIDEOS_LIMIT_PER_SYNCHRONIZATION,
        channelSync: sync,
        onlyAfter
      })
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
