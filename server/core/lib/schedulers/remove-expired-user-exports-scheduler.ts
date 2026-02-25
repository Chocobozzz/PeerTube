import { UserExportModel } from '@server/models/user/user-export.js'
import { logger, loggerTagsFactory } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const lTags = loggerTagsFactory('schedulers')

export class RemoveExpiredUserExportsScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.REMOVE_EXPIRED_USER_EXPORTS

  private constructor () {
    super({ randomRunOnEnable: false })
  }

  protected async internalExecute () {
    logger.info('Running expired user exports checker.', lTags())

    const expired = await UserExportModel.listExpired(CONFIG.EXPORT.USERS.EXPORT_EXPIRATION)

    for (const userExport of expired) {
      logger.info(`Removing expired user exports ${userExport.filename}`, lTags())

      await userExport.destroy()
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
