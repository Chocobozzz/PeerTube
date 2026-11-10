import { randomInt } from 'node:crypto'
import { createLogger } from '../../helpers/logger.js'

const logger = createLogger('schedulers')

export abstract class AbstractScheduler {
  private static readonly enabledSchedulers = new Set<AbstractScheduler>()

  protected abstract schedulerIntervalMs: number

  private interval: NodeJS.Timeout
  private firstRunTimeout: NodeJS.Timeout
  private isRunning = false

  // Incremented on each enable/disable, so a pending first run knows if it still belongs to the current activation
  private generation = 0

  private readonly randomRunOnEnable: boolean
  private readonly firstRunDelayMs: number

  constructor (options: {
    // Run at a random time in the first half of the interval
    randomRunOnEnable?: boolean
    // Or run after this delay
    firstRunDelayMs?: number
  }) {
    if (options?.randomRunOnEnable === true) {
      this.randomRunOnEnable = true
    }

    this.firstRunDelayMs = options?.firstRunDelayMs
  }

  static disableAll () {
    for (const scheduler of this.enabledSchedulers) {
      scheduler.disable()
    }
  }

  enable () {
    if (!this.schedulerIntervalMs) throw new Error('Interval is not correctly set.')

    AbstractScheduler.enabledSchedulers.add(this)
    const generation = ++this.generation

    const firstRunDelay = this.randomRunOnEnable === true
      ? randomInt(0, Math.floor(this.schedulerIntervalMs / 2))
      : this.firstRunDelayMs

    if (firstRunDelay !== undefined) {
      this.firstRunTimeout = setTimeout(async () => {
        this.firstRunTimeout = undefined

        try {
          // execute() already handles errors
          await this.execute()
        } finally {
          // The scheduler may have been disabled (and re-enabled) during the first run
          if (this.generation === generation) {
            this.interval = setInterval(() => this.execute(), this.schedulerIntervalMs)
          }
        }
      }, firstRunDelay)

      return
    }

    this.interval = setInterval(() => this.execute(), this.schedulerIntervalMs)
  }

  disable () {
    AbstractScheduler.enabledSchedulers.delete(this)
    this.generation++

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
