import Bluebird from 'bluebird'
import { randomInt } from 'node:crypto'
import { logger, loggerTagsFactory } from '../../helpers/logger.js'

const lTags = loggerTagsFactory('schedulers')

export abstract class AbstractScheduler {
  protected abstract schedulerIntervalMs: number

  private interval: NodeJS.Timeout
  private firstRunTimeout: NodeJS.Timeout
  private isRunning = false

  private readonly randomRunOnEnable: boolean

  constructor (options: {
    randomRunOnEnable?: boolean
  }) {
    if (options?.randomRunOnEnable === true) {
      this.randomRunOnEnable = true
    }
  }

  enable () {
    if (!this.schedulerIntervalMs) throw new Error('Interval is not correctly set.')

    if (this.randomRunOnEnable === true) {
      const randomDelay = randomInt(0, Math.floor(this.schedulerIntervalMs / 2))

      this.firstRunTimeout = setTimeout(async () => {
        try {
          // execute() already handles errors
          await this.execute()
        } finally {
          this.interval = setInterval(() => this.execute(), this.schedulerIntervalMs)
        }
      }, randomDelay)

      return
    }

    this.interval = setInterval(() => this.execute(), this.schedulerIntervalMs)
  }

  disable () {
    if (this.firstRunTimeout) {
      clearTimeout(this.firstRunTimeout)
      this.firstRunTimeout = undefined
    }

    if (this.interval) {
      clearInterval(this.interval)
      this.interval = undefined
    }
  }

  async execute () {
    if (this.isRunning === true) return
    this.isRunning = true

    try {
      await this.internalExecute()
    } catch (err) {
      logger.error('Cannot execute ' + this.constructor.name + ' scheduler.', { err, ...lTags() })
    } finally {
      this.isRunning = false
    }
  }

  protected abstract internalExecute (): Promise<any> | Bluebird<any>
}
