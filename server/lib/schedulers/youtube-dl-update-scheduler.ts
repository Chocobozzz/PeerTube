

import { AbstractScheduler } from './abstract-scheduler'
import { SCHEDULER_INTERVALS_MS } from '../../initializers'
import { logger } from '../../helpers/logger'
import * as request from 'request'
import { createWriteStream, ensureDir, writeFile } from 'fs-extra'
import { join } from 'path'
import { root } from '../../helpers/core-utils'
import { updateYoutubeDLBinary } from '../../helpers/youtube-dl'

export class YoutubeDlUpdateScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.youtubeDLUpdate

  private constructor () {
    super()
  }

  execute () {
    return updateYoutubeDLBinary()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
