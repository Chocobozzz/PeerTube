import { ClientLogCreate, HttpStatusCode, ServerLogLevel } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class LogsCommand extends AbstractCommand {

  createLogClient (options: OverrideCommandOptions & { payload: ClientLogCreate }) {
    const path = '/api/v1/server/logs/client'

    return this.postBodyRequest({
      ...options,

      path,
      fields: options.payload,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  getLogs (options: OverrideCommandOptions & {
    startDate: Date
    endDate?: Date
    level?: ServerLogLevel
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
