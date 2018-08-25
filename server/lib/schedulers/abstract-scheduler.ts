export abstract class AbstractScheduler {

  protected abstract schedulerIntervalMs: number

  private interval: NodeJS.Timer

  enable () {
    if (!this.schedulerIntervalMs) throw new Error('Interval is not correctly set.')

    this.interval = setInterval(() => this.execute(), this.schedulerIntervalMs)
  }

  disable () {
    clearInterval(this.interval)
  }

  abstract execute ()
}
