import { logger } from '../../helpers/logger'
import * as Bluebird from 'bluebird'

export abstract class AbstractScheduler {

  protected abstract schedulerIntervalMs: number

  private interval: NodeJS.Timer
  private isRunning = false

  enable () {
    if (!this.schedulerIntervalMs) throw new Error('Interval is not correctly set.')

    this.interval = setInterval(() => this.execute(), this.schedulerIntervalMs)
  }

  disable () {
    clearInterval(this.interval)
  }

  async execute () {
    if (this.isRunning === true) return
    this.isRunning = true

    try {
      await this.internalExecute()
    } catch (err) {
      logger.error('Cannot execute %s scheduler.', this.constructor.name, { err })
    } finally {
      this.isRunning = false
    }
  }

  protected abstract internalExecute (): Promise<any> | Bluebird<any>
}
