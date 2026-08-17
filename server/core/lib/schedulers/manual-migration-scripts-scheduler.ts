import { ApplicationModel } from '@server/models/application/application.js'
import { createLogger } from '../../helpers/logger.js'
import { MANUAL_MIGRATION_SCRIPTS, SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const logger = createLogger('schedulers')

export class ManualMigrationScriptsScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.CHECK_MANUAL_MIGRATION_SCRIPTS

  private constructor () {
    super({ randomRunOnEnable: true })
  }

  protected async internalExecute () {
    return this.checkMigrationScriptsRun()
  }

  private async checkMigrationScriptsRun () {
    const application = await ApplicationModel.load()

    const missing = MANUAL_MIGRATION_SCRIPTS.filter(script => !application.manualMigrationScriptsRun.includes(script))
    if (missing.length === 0) return

    logger.warn(
      'The following manual migration scripts have not been run yet: %s. ' +
        'Check the CHANGELOG for instructions on how to run them.',
      missing.join(', ')
    )
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
