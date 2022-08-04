import { logger } from '@server/helpers/logger'
import { YoutubeDLCLI } from '@server/helpers/youtube-dl'
import { CONFIG } from '@server/initializers/config'
import { VideoChannelSyncModel } from '@server/models/video/video-channel-sync'
import { VideoChannelSyncState } from '@shared/models'
import { SCHEDULER_INTERVALS_MS, VIDEO_CHANNEL_MAX_SYNC } from '../../initializers/constants'
import { synchronizeChannel } from '../video-import-channel'
import { AbstractScheduler } from './abstract-scheduler'

export class VideoChannelSyncLatestScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler
  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.CHANNEL_SYNC_CHECK_INTERVAL

  private constructor () {
    super()
  }

  protected async internalExecute () {
    logger.debug('Running processVideoChannelsSync')
    if (!CONFIG.IMPORT.SYNCHRONIZATION.ENABLED) {
      logger.info('Discard channels synchronization as the feature is disabled')
      return
    }
    const syncs: VideoChannelSyncModel[] = await VideoChannelSyncModel.listSyncs()
    const youtubeDL = await YoutubeDLCLI.safeGet()

    for (const sync of syncs) {
      try {
        const syncCreationDate = sync.createdAt
        sync.state = VideoChannelSyncState.PROCESSING
        sync.lastSyncAt = new Date()
        await sync.save()
        // Format
        logger.info(`Starting synchronizing "${sync.VideoChannel.name}" with external channel "${sync.externalChannelUrl}"`)
        const { errors, successes, alreadyImported } = await synchronizeChannel(sync.VideoChannel, sync.externalChannelUrl, {
          youtubeDL,
          secondsToWait: 5,
          lastVideosCount: VIDEO_CHANNEL_MAX_SYNC,
          after: this.formatDateForYoutubeDl(syncCreationDate)
        })
        if (errors > 0) {
          sync.state = VideoChannelSyncState.FAILED
          logger.error(`Finished synchronizing "${sync.VideoChannel.name}" with failures` +
          ` (failures: ${errors}, imported: ${successes}, ignored because already imported: ${alreadyImported}). Please check the logs.`)
        } else {
          sync.state = VideoChannelSyncState.SYNCED
          logger.info(`Finished synchronizing "${sync.VideoChannel.name}" successfully` +
          ` (imported: ${successes}, ignored because already imported: ${alreadyImported})`)
        }
        await sync.save()
      } catch (err) {
        logger.error(`Failed to synchronize channel ${sync.VideoChannel.name}`, { err })
      }
    }
  }

  private formatDateForYoutubeDl (date: Date) {
    return `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${(date.getDate()).toString().padStart(2, '0')}`
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
