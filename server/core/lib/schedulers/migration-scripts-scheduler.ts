import {
  isAutomaticMigrationScript,
  MIGRATION_SCRIPT_NAMES,
  runAutomaticMigrationScript
} from '@server/lib/migration-scripts/migration-scripts.js'
import { ApplicationModel } from '@server/models/application/application.js'
import { createLogger } from '../../helpers/logger.js'
import { MIGRATION_SCRIPTS, SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const logger = createLogger('migration-scripts')

export class MigrationScriptsScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.RUN_MIGRATION_SCRIPTS

  private constructor () {
    super({ firstRunDelayMs: MIGRATION_SCRIPTS.FIRST_RUN_DELAY_MS })
  }

  protected async internalExecute () {
    const application = await ApplicationModel.load()

    const missing = MIGRATION_SCRIPT_NAMES.filter(script => !application.manualMigrationScriptsRun.includes(script))
    if (missing.length === 0) return

    for (const script of missing) {
      // Scripts must be run in order: an automatic script may depend on a previous manual one
      if (!isAutomaticMigrationScript(script)) break

      const success = await this.runScript(script)
      if (!success) return
    }

    const manual = missing.filter(s => !isAutomaticMigrationScript(s))
    if (manual.length === 0) return

    logger.warn(
      'The following manual migration scripts have not been run yet: %s. ' +
        'Check the CHANGELOG for instructions on how to run them. ' +
        'Automatic migration scripts that come after them will be run once they are done.',
      manual.join(', ')
    )
  }

  private async runScript (script: string) {
    logger.info(`Running migration script ${script} in the background. It may take a while.`)

    const start = Date.now()

    try {
      const result = await runAutomaticMigrationScript(script, logger, { waitForLock: false })

      if (result === 'locked') {
        logger.info(`Migration scripts are being run by another process, skipping ${script}. It will be checked again in a few hours.`)
        return false
      }

      if (result === 'run') {
        logger.info(`Migration script ${script} finished in ${Math.round((Date.now() - start) / 1000)}s.`)
      }

      return true
    } catch (err) {
      logger.error(
        `Error in migration script ${script}. ` +
          `It will be retried in a few hours or at the next PeerTube startup. You can also run it manually (see the CHANGELOG).`,
        { err }
      )

      return false
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
