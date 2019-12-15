import { logger } from '../../helpers/logger'
import { AbstractScheduler } from './abstract-scheduler'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants'
import { UserVideoHistoryModel } from '../../models/account/user-video-history'
import { CONFIG } from '../../initializers/config'

export class RemoveOldHistoryScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.removeOldHistory

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
