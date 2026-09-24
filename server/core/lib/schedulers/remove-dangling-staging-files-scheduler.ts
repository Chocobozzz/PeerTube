import { createLogger } from '@server/helpers/logger.js'
import { SCHEDULER_INTERVALS_MS } from '@server/initializers/constants.js'
import { isStagingEnabled } from '../object-storage/config.js'
import { removeExpiredStagingFiles } from '../object-storage/staging.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const logger = createLogger('schedulers', 'staging', 'cleaner')

export class RemoveDanglingStagingFilesScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.REMOVE_DANGLING_STAGING_FILES

  private constructor () {
    super({ randomRunOnEnable: false })
  }

  protected async internalExecute () {
    if (!isStagingEnabled()) return

    logger.info('Removing dangling object storage staging files')

    try {
      await removeExpiredStagingFiles()
    } catch (err) {
      logger.error('Cannot remove dangling object storage staging files', { err })
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
