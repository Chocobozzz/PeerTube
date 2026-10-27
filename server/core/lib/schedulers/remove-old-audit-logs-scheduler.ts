import { createLogger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { AuditLogModel } from '../../models/server/audit-log.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const logger = createLogger('schedulers')

export class RemoveOldAuditLogsScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.REMOVE_OLD_AUDIT_LOGS

  private constructor () {
    super({ randomRunOnEnable: true })
  }

  protected internalExecute () {
    if (CONFIG.LOG.AUDIT.MAX_AGE === -1) return

    logger.info('Removing old audit logs.')

    const now = new Date()
    const beforeDate = new Date(now.getTime() - CONFIG.LOG.AUDIT.MAX_AGE).toISOString()

    return AuditLogModel.removeOldLogs(beforeDate)
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
