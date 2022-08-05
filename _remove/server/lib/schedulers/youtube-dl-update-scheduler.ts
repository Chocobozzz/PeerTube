import { YoutubeDLCLI } from '@server/helpers/youtube-dl'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants'
import { AbstractScheduler } from './abstract-scheduler'

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
