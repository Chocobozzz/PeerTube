import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants'
import { processVideoChannelsSync } from '../job-queue/handlers/video-channels-sync'
import { AbstractScheduler } from './abstract-scheduler'

export class VideoChannelSyncLatestScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler
  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.CHANNEL_SYNC_CHECK_INTERVAL

  private constructor () {
    super()
  }

  protected async internalExecute () {
    // FIXME move the job here, don't call the job handler
    await processVideoChannelsSync()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
