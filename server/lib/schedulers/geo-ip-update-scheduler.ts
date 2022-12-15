import { GeoIP } from '@server/helpers/geo-ip'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants'
import { AbstractScheduler } from './abstract-scheduler'

export class GeoIPUpdateScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.GEO_IP_UPDATE

  private constructor () {
    super()
  }

  protected internalExecute () {
    return GeoIP.Instance.updateDatabase()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
