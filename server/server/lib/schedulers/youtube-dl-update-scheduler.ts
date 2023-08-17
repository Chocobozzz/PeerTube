import { YoutubeDLCLI } from '@server/helpers/youtube-dl/index.js'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { AbstractScheduler } from './abstract-scheduler.js'

export class YoutubeDlUpdateScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.YOUTUBE_DL_UPDATE

  private constructor () {
    super()
  }

  protected internalExecute () {
    return YoutubeDLCLI.updateYoutubeDLBinary()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
