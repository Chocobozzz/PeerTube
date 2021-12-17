import { HttpStatusCode, LogLevel } from '@shared/models'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class LogsCommand extends AbstractCommand {

  getLogs (options: OverrideCommandOptions & {
    startDate: Date
    endDate?: Date
    level?: LogLevel
    tagsOneOf?: string[]
  }) {
    const { startDate, endDate, tagsOneOf, level } = options
    const path = '/api/v1/server/logs'

    return this.getRequestBody<any[]>({
      ...options,

      path,
      query: { startDate, endDate, level, tagsOneOf },
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
