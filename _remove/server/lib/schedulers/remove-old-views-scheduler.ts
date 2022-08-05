import { VideoViewModel } from '@server/models/view/video-view'
import { logger } from '../../helpers/logger'
import { CONFIG } from '../../initializers/config'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants'
import { AbstractScheduler } from './abstract-scheduler'

export class RemoveOldViewsScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.REMOVE_OLD_VIEWS

  private constructor () {
    super()
  }

  protected internalExecute () {
    if (CONFIG.VIEWS.VIDEOS.REMOTE.MAX_AGE === -1) return

    logger.info('Removing old videos views.')

    const now = new Date()
    const beforeDate = new Date(now.getTime() - CONFIG.VIEWS.VIDEOS.REMOTE.MAX_AGE).toISOString()

    return VideoViewModel.removeOldRemoteViewsHistory(beforeDate)
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
