import { randomInt } from 'node:crypto'
import { createLogger } from '../../helpers/logger.js'

const logger = createLogger('schedulers')

export abstract class AbstractScheduler {
  private static readonly enabledSchedulers = new Set<AbstractScheduler>()

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

  static disableAll () {
    for (const scheduler of this.enabledSchedulers) {
      scheduler.disable()
    }
  }

  enable () {
    if (!this.schedulerIntervalMs) throw new Error('Interval is not correctly set.')

    AbstractScheduler.enabledSchedulers.add(this)

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
    AbstractScheduler.enabledSchedulers.delete(this)

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
      logger.error('Cannot execute ' + this.constructor.name + ' scheduler.', { err })
    } finally {
      this.isRunning = false
    }
  }

  protected abstract internalExecute (): Promise<any>
}
