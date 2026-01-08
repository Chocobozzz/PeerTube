import { LocalVideoViewerModel } from '@server/models/view/local-video-viewer.js'
import { VideoViewModel } from '@server/models/view/video-view.js'
import { logger, loggerTagsFactory } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const lTags = loggerTagsFactory('schedulers')

export class RemoveOldViewsScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.REMOVE_OLD_VIEWS

  private constructor () {
    super({ randomRunOnEnable: true })
  }

  protected async internalExecute () {
    await this.removeRemoteViews()
    await this.removeLocalViews()
  }

  private removeRemoteViews () {
    if (CONFIG.VIEWS.VIDEOS.REMOTE.MAX_AGE <= 0) return

    logger.info('Removing old views from remote videos.', lTags())

    const now = new Date()
    const beforeDate = new Date(now.getTime() - CONFIG.VIEWS.VIDEOS.REMOTE.MAX_AGE).toISOString()

    return VideoViewModel.removeOldRemoteViews(beforeDate)
  }

  private async removeLocalViews () {
    if (CONFIG.VIEWS.VIDEOS.LOCAL.MAX_AGE <= 0) return

    logger.info('Removing old views from local videos.', lTags())

    const now = new Date()
    const beforeDate = new Date(now.getTime() - CONFIG.VIEWS.VIDEOS.LOCAL.MAX_AGE).toISOString()

    await VideoViewModel.removeOldLocalViews(beforeDate)
    await LocalVideoViewerModel.removeOldViews(beforeDate)
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
