import { logger } from '../../helpers/logger.js'
import { AbstractScheduler } from './abstract-scheduler.js'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { UserVideoHistoryModel } from '../../models/user/user-video-history.js'
import { CONFIG } from '../../initializers/config.js'

export class RemoveOldHistoryScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.REMOVE_OLD_HISTORY

  private constructor () {
    super()
  }

  protected internalExecute () {
    if (CONFIG.HISTORY.VIDEOS.MAX_AGE === -1) return

    logger.info('Removing old videos history.')

    const now = new Date()
    const beforeDate = new Date(now.getTime() - CONFIG.HISTORY.VIDEOS.MAX_AGE).toISOString()

    return UserVideoHistoryModel.removeOldHistory(beforeDate)
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
