import { AbstractScheduler } from './abstract-scheduler'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants'
import { updateYoutubeDLBinary } from '../../helpers/youtube-dl'

export class YoutubeDlUpdateScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.youtubeDLUpdate

  private constructor () {
    super()
  }

  protected internalExecute () {
    return updateYoutubeDLBinary()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
