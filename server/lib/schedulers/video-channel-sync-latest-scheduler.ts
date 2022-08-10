import { logger } from '@server/helpers/logger'
import { CONFIG } from '@server/initializers/config'
import { VideoChannelModel } from '@server/models/video/video-channel'
import { VideoChannelSyncModel } from '@server/models/video/video-channel-sync'
import { VideoChannelSyncState } from '@shared/models'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants'
import { synchronizeChannel } from '../sync-channel'
import { AbstractScheduler } from './abstract-scheduler'

export class VideoChannelSyncLatestScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler
  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.CHANNEL_SYNC_CHECK_INTERVAL

  private constructor () {
    super()
  }

  protected async internalExecute () {
    logger.debug('Running %s.%s', this.constructor.name, this.internalExecute.name)

    if (!CONFIG.IMPORT.VIDEO_CHANNEL_SYNCHRONIZATION.ENABLED) {
      logger.info('Discard channels synchronization as the feature is disabled')
      return
    }

    const channelSyncs = await VideoChannelSyncModel.listSyncs()

    for (const sync of channelSyncs) {
      const channel = await VideoChannelModel.loadAndPopulateAccount(sync.videoChannelId)

      try {
        logger.info(
          'Creating video import jobs for "%s" sync with external channel "%s"',
          channel.Actor.preferredUsername, sync.externalChannelUrl
        )

        const onlyAfter = sync.lastSyncAt || sync.createdAt

        sync.state = VideoChannelSyncState.PROCESSING
        sync.lastSyncAt = new Date()
        await sync.save()

        await synchronizeChannel({
          channel,
          externalChannelUrl: sync.externalChannelUrl,
          videosCountLimit: CONFIG.IMPORT.VIDEO_CHANNEL_SYNCHRONIZATION.VIDEOS_LIMIT_PER_SYNCHRONIZATION,
          channelSync: sync,
          onlyAfter
        })
      } catch (err) {
        logger.error(`Failed to synchronize channel ${channel.Actor.preferredUsername}`, { err })
        sync.state = VideoChannelSyncState.FAILED
        await sync.save()
      }
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
