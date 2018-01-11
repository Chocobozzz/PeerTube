import { SCHEDULER_INTERVAL } from '../../initializers'

export abstract class AbstractScheduler {

  private interval: NodeJS.Timer

  enable () {
    this.interval = setInterval(() => this.execute(), SCHEDULER_INTERVAL)
  }

  disable () {
    clearInterval(this.interval)
  }

  protected abstract execute ()
}
