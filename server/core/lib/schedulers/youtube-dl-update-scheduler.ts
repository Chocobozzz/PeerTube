import { createLogger } from '@server/helpers/logger.js'
import { YoutubeDLCLI } from '@server/helpers/youtube-dl/index.js'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const logger = createLogger('schedulers', 'youtube-dl')

export class YoutubeDlUpdateScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.YOUTUBE_DL_UPDATE

  private constructor () {
    super({ randomRunOnEnable: true })
  }

  protected internalExecute () {
    logger.info('Running youtube-dl updated scheduler')

    return YoutubeDLCLI.updateYoutubeDLBinary()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
