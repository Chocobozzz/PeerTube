import { pick, wait } from '@peertube/peertube-core-utils'
import {
  AuditLog,
  AuditLogActionType,
  AuditLogEntityTypeType,
  ClientLogCreate,
  HttpStatusCode,
  ResultList,
  ServerLogLevel
} from '@peertube/peertube-models'
import { expect } from 'chai'
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

  listAuditLogs (options: ListAuditLogsOptions = {}) {
    const path = '/api/v1/server/audit-logs'

    return this.getRequestBody<ResultList<AuditLog>>({
      ...options,

      path,
      query: {
        ...pick(options, [ 'start', 'count', 'sort', 'search', 'entityType', 'entityId', 'action', 'startDate', 'endDate' ]),

        format: 'list'
      },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  // Audit logs are inserted asynchronously: wait until exactly `total` entries match the query
  async waitAuditLogs (options: ListAuditLogsOptions & { total: number }) {
    const { total, ...query } = options

    for (let i = 0; i < 100; i++) {
      const body = await this.listAuditLogs({ sort: 'createdAt', count: 100, ...query })

      if (body.total >= total) {
        expect(body.total, `${query.entityType ?? ''} ${query.action ?? ''} audit logs`).to.equal(total)
        expect(body.data).to.have.lengthOf(total)

        return body.data
      }

      await wait(100)
    }

    throw new Error(`Cannot find ${total} audit logs matching ${JSON.stringify(query)}`)
  }
}

type ListAuditLogsOptions = OverrideCommandOptions & {
  start?: number
  count?: number
  sort?: string
  search?: string
  entityType?: AuditLogEntityTypeType
  entityId?: number
  action?: AuditLogActionType
  startDate?: Date
  endDate?: Date
}
