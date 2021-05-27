import { YoutubeDL } from '@server/helpers/youtube-dl'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants'
import { AbstractScheduler } from './abstract-scheduler'

export class YoutubeDlUpdateScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.youtubeDLUpdate

  private constructor () {
    super()
  }

  protected internalExecute () {
    return YoutubeDL.updateYoutubeDLBinary()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
