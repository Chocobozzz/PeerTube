import { GeoIP } from '@server/helpers/geo-ip.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const lTags = loggerTagsFactory('schedulers')

export class GeoIPUpdateScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.GEO_IP_UPDATE

  private constructor () {
    super({ randomRunOnEnable: true })
  }

  protected internalExecute () {
    logger.info('Running GeoIP update scheduler', lTags())

    return GeoIP.Instance.updateDatabases()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
