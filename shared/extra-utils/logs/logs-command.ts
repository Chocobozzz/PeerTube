import { HttpStatusCode } from '../../core-utils/miscs/http-error-codes'
import { LogLevel } from '../../models/server/log-level.type'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class LogsCommand extends AbstractCommand {

  getLogs (options: OverrideCommandOptions & {
    startDate: Date
    endDate?: Date
    level?: LogLevel
  }) {
    const { startDate, endDate, level } = options
    const path = '/api/v1/server/logs'

    return this.getRequestBody({
      ...options,

      path,
      query: { startDate, endDate, level },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getAuditLogs (options: OverrideCommandOptions & {
    startDate: Date
    endDate?: Date
  }) {
    const { startDate, endDate } = options

    const path = '/api/v1/server/audit-logs'

    return this.getRequestBody({
      ...options,

      path,
      query: { startDate, endDate },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

}
