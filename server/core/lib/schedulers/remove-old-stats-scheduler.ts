import { LocalVideoViewerModel } from '@server/models/stat/local-video-viewer.js'
import { VideoStatModel } from '@server/models/stat/video-stat.js'
import { logger, loggerTagsFactory } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const lTags = loggerTagsFactory('schedulers')

export class RemoveOldStatsScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.REMOVE_OLD_STATS

  private constructor () {
    super({ randomRunOnEnable: true })
  }

  protected async internalExecute () {
    await this.removeRemoteViews()
    await this.removeLocalViews()
  }

  private removeRemoteViews () {
    if (CONFIG.VIEWS.VIDEOS.REMOTE.MAX_AGE <= 0) return

    logger.info('Removing old stats from remote videos.', lTags())

    const now = new Date()
    const beforeDate = new Date(now.getTime() - CONFIG.VIEWS.VIDEOS.REMOTE.MAX_AGE).toISOString()

    return VideoStatModel.removeOldRemoteStats(beforeDate)
  }

  private async removeLocalViews () {
    if (CONFIG.VIEWS.VIDEOS.LOCAL.MAX_AGE <= 0) return

    logger.info('Removing old stats from local videos.', lTags())

    const now = new Date()
    const beforeDate = new Date(now.getTime() - CONFIG.VIEWS.VIDEOS.LOCAL.MAX_AGE).toISOString()

    await VideoStatModel.removeOldLocalStats(beforeDate)
    await LocalVideoViewerModel.removeOldViews(beforeDate)
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
